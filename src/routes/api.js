'use strict';

const express = require('express');
const router = express.Router();

const { nominatimFetch, photonFetch, NOM_HIGH } = require('../services/geocoding');
const { addHebrewArticle, stripHebrewArticle } = require('../utils/hebrewUtils');
const { deduplicateAll } = require('../utils/dedup');
const haversine = require('../utils/haversine');
const { findSheltersByAddress } = require('../services/shelterSearch');
const { fetchAllSources } = require('../sources');
const { allStaticShelters } = require('../sources/staticCities');
const { GOV_RESOURCES, GEOJSON_RESOURCES } = require('../config');
const cache = require('../cache');

// ─────────────────────────────────────────────
// GET /api/geocode?q=<address>
// ─────────────────────────────────────────────
router.get('/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

  const isSuggest = req.query.suggest === '1';

  // Autocomplete (suggest=1): try Photon (fast, no rate-limit), fall back to Nominatim
  if (isSuggest) {
    try {
      return res.json(await photonFetch(q, 5, req.query.lang));
    } catch (photonErr) {
      console.warn('[geocode/suggest] Photon failed, using Nominatim:', photonErr.message);
    }
    try {
      const r = await nominatimFetch(q, { limit: 5, priority: NOM_HIGH, dropType: 'autocomplete', lang: req.query.lang || 'he' });
      if (!r.ok) return res.status(503).json({ error: 'geocode_busy' });
      return res.json(await r.json());
    } catch (e) {
      if (e.superseded) return res.status(204).end();
      return res.status(503).json({ error: 'geocode_busy' });
    }
  }

  // Explicit search: Nominatim first (best Hebrew quality), Photon fallback on 429
  try {
    const r = await nominatimFetch(q, { limit: 6, addressdetails: 1, priority: NOM_HIGH, lang: req.query.lang || 'he' });
    if (r.status === 429) {
      console.warn('[geocode] Nominatim 429 \u2192 Photon fallback');
      try {
        return res.json(await photonFetch(q, 6, req.query.lang));
      } catch (pe) {
        console.error('[geocode] Photon fallback failed:', pe.message);
        return res.status(503).json({ error: 'geocode_busy' });
      }
    }
    if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`);
    let results = await r.json();

    // Hebrew article prefix retry: if 0 results, try adding "\u05D4" to first word
    if (results.length === 0) {
      const heRetry = addHebrewArticle(q);
      if (heRetry) {
        console.log(`[geocode] 0 results for "${q}" \u2192 retrying with "${heRetry}"`);
        try {
          const r2 = await nominatimFetch(heRetry, { limit: 6, addressdetails: 1, priority: NOM_HIGH, lang: req.query.lang || 'he' });
          if (r2.ok) {
            const retry = await r2.json();
            if (retry.length > 0) results = retry;
          }
        } catch (_) { /* ignore retry errors */ }
      }
    }

    // Hebrew article STRIP retry: if still 0 results and first word starts with ה, try without
    if (results.length === 0) {
      const heStrip = stripHebrewArticle(q);
      if (heStrip) {
        console.log(`[geocode] 0 results for "${q}" → retrying without ה: "${heStrip}"`);
        try {
          const r3 = await nominatimFetch(heStrip, { limit: 6, addressdetails: 1, priority: NOM_HIGH, lang: req.query.lang || 'he' });
          if (r3.ok) {
            const retry2 = await r3.json();
            if (retry2.length > 0) results = retry2;
          }
        } catch (_) { /* ignore retry errors */ }
      }
    }

    // Shelter-data geocode: always check our own shelter data for matching addresses.
    // Our shelter coordinates (from Google Geocoding) are more precise than Nominatim
    // which often returns a midpoint on the street, hundreds of meters from the house number.
    {
      let addrMatches = findSheltersByAddress(q, allStaticShelters);
      // If matches span multiple cities, keep only the city mentioned in the query
      if (addrMatches.length > 1) {
        const cities = [...new Set(addrMatches.map(m => m.city).filter(Boolean))];
        if (cities.length > 1) {
          // Prefer the city whose name appears in the query
          const queriedCity = cities.find(c => q.includes(c));
          if (queriedCity) {
            addrMatches = addrMatches.filter(m => m.city === queriedCity);
          } else if (results.length > 0 && results[0].address) {
            // No city in query — use Nominatim's city to pick the right matches
            const nomCity = results[0].address.city || results[0].address.town || results[0].address.village || '';
            const nomMatch = nomCity && cities.find(c => nomCity.includes(c) || c.includes(nomCity));
            if (nomMatch) {
              addrMatches = addrMatches.filter(m => m.city === nomMatch);
            } else {
              // Nominatim found a city we don't have shelter-data for — don't override
              addrMatches = [];
            }
          } else {
            // No Nominatim results at all — keep city with most matches
            const cityCounts = {};
            for (const m of addrMatches) cityCounts[m.city] = (cityCounts[m.city] || 0) + 1;
            const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0][0];
            addrMatches = addrMatches.filter(m => m.city === topCity);
          }
        }
      }
      if (addrMatches.length > 0) {
        const avgLat = addrMatches.reduce((s, m) => s + m.lat, 0) / addrMatches.length;
        const avgLon = addrMatches.reduce((s, m) => s + m.lon, 0) / addrMatches.length;
        const city = addrMatches[0].city || '';
        console.log(`[geocode] shelter-data match for "${q}": ${addrMatches.length} shelters in ${city}`);
        results = [{
          lat: String(avgLat),
          lon: String(avgLon),
          display_name: `${addrMatches[0].address}, ${city}`,
          type: 'shelter_fallback',
          address: { city, country: 'ישראל' },
        }];
      }
    }

        // City-name fallback: if all retries returned 0 results, try geocoding just the city name.
    // This lets addr-match find the specific shelter even when Nominatim doesn't know the street.
    if (results.length === 0) {
      const parts = q.split(/[,،]/); // split on comma
      const cityPart = parts.length > 1 ? parts[parts.length - 1].trim() : null;
      if (cityPart && cityPart.length >= 2) {
        console.log(`[geocode] 0 results for "${q}" → city fallback: "${cityPart}"`);
        try {
          const rc = await nominatimFetch(cityPart, { limit: 1, addressdetails: 1, priority: NOM_HIGH, lang: req.query.lang || 'he' });
          if (rc.ok) {
            const cityResults = await rc.json();
            if (cityResults.length > 0) results = cityResults;
          }
        } catch (_) { /* ignore */ }
      }
    }

    res.json(results);
  } catch (e) {
    console.error('[geocode]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/shelters?lat=&lon=&radius=
// ─────────────────────────────────────────────
router.get('/shelters', async (req, res) => {
  const { lat, lon, radius = 2000, q: addrQuery } = req.query;

  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat and/or lon' });

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const radiusM = Math.min(Math.max(parseInt(radius, 10) || 2000, 100), 10000);

  if (isNaN(userLat) || isNaN(userLon))
    return res.status(400).json({ error: 'Invalid lat/lon values' });

  try {
    const { shelters: rawShelters, errors } = await fetchAllSources(userLat, userLon, radiusM);

    let shelters = deduplicateAll(rawShelters);
    shelters = shelters
      .map(s => ({ ...s, dist: haversine(userLat, userLon, s.lat, s.lon) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 150);

    // Address-based matching: if a query string is provided, find shelters
    // matching the street name in our static data and boost/include them
    if (addrQuery && addrQuery.trim().length > 2) {
      const addrMatches = findSheltersByAddress(addrQuery, allStaticShelters);
      if (addrMatches.length > 0) {
        const matchesWithDist = addrMatches.map(s => ({
          ...s,
          dist: haversine(userLat, userLon, s.lat, s.lon),
          addrMatch: true
        }));
        const existingIds = new Set(shelters.map(s => s.id));
        const newMatches = matchesWithDist.filter(s => {
          if (existingIds.has(s.id)) return false;
          // Only skip if an existing result has the same address (true duplicate)
          const sAddr = (s.address || '').trim();
          if (sAddr) {
            return !shelters.some(e => (e.address || '').trim() === sAddr);
          }
          // No address: fall back to proximity check (100m)
          return !shelters.some(e => haversine(e.lat, e.lon, s.lat, s.lon) * 1000 < 100);
        });
        if (newMatches.length > 0) {
          shelters = shelters.concat(newMatches);
          shelters.sort((a, b) => {
            // Only boost addr-matched results within the search radius
            const aBoost = a.addrMatch && a.dist * 1000 <= radiusM;
            const bBoost = b.addrMatch && b.dist * 1000 <= radiusM;
            if (aBoost && !bBoost) return -1;
            if (!aBoost && bBoost) return 1;
            return a.dist - b.dist;
          });
          shelters = shelters.slice(0, 150);
        } else {
          shelters.forEach(s => {
            if (addrMatches.some(m => m.id === s.id)) s.addrMatch = true;
          });
          shelters.sort((a, b) => {
            // Only boost addr-matched results within the search radius
            const aBoost = a.addrMatch && a.dist * 1000 <= radiusM;
            const bBoost = b.addrMatch && b.dist * 1000 <= radiusM;
            if (aBoost && !bBoost) return -1;
            if (!aBoost && bBoost) return 1;
            return a.dist - b.dist;
          });
        }
      }
    }

    // Count by category and source
    const catCounts = { public: 0, school: 0, parking: 0 };
    const srcCounts = { osm: 0, gov: 0, arcgis: 0 };
    for (const s of shelters) {
      catCounts[s.category] = (catCounts[s.category] || 0) + 1;
      srcCounts[s.source]   = (srcCounts[s.source]   || 0) + 1;
    }

    console.log(
      `[shelters] lat=${userLat} lon=${userLon} r=${radiusM}m \u2192 ` +
      `public:${catCounts.public} school:${catCounts.school} parking:${catCounts.parking}`
    );

    res.json({
      shelters,
      total: shelters.length,
      radius: radiusM,
      sources: {
        ...srcCounts,
        ...catCounts,
        ...errors,
      },
    });
  } catch (e) {
    console.error('[shelters]', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    dataSources: [
      'osm', 'data.gov.il', 'geojson', 'arcgis-national',
      'haifa-gis', 'tel-aviv-gis', 'petah-tikva-gis',
      'herzliya-static', 'ashkelon-gis', 'holon-static', 'kfar-saba-static', 'rehovot-gis',
      'rishon-lezion-html',
      'netanya-static',
      'bat-yam-static', 'ashdod-static', 'or-yehuda-static',
      'kfar-yona-static', 'kiryat-ono-static', 'dimona-static',
      'givatayim-static', 'bnei-brak-static', 'nesher-static', 'ramat-gan-static', 'eilat-static',
      'modiin-illit-static', 'modiin-maccabim-reut-static', 'hadera-static',
      'afula-static',
      'kiryat-shmona-static',
      'yehud-static',
      'atlit-static',
      'beit-shemesh-static',
    ],
    cities: [
      ...GOV_RESOURCES.map(r => r.city),
      ...GEOJSON_RESOURCES.map(r => r.city),
      '\u05D7\u05D9\u05E4\u05D4', '\u05EA\u05DC \u05D0\u05D1\u05D9\u05D1-\u05D9\u05E4\u05D5', '\u05E4\u05EA\u05D7 \u05EA\u05E7\u05D5\u05D5\u05D4',
      '\u05D4\u05E8\u05E6\u05DC\u05D9\u05D4', '\u05D0\u05E9\u05E7\u05DC\u05D5\u05DF', '\u05D7\u05D5\u05DC\u05D5\u05DF', '\u05DB\u05E4\u05E8 \u05E1\u05D1\u05D0', '\u05E8\u05D7\u05D5\u05D1\u05D5\u05EA', '\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF', '\u05D9\u05D4\u05D5\u05D3-\u05DE\u05D5\u05E0\u05D5\u05E1\u05D5\u05DF', '\u05E0\u05EA\u05E0\u05D9\u05D4', '\u05D1\u05EA \u05D9\u05DD', '\u05D0\u05E9\u05D3\u05D5\u05D3', '\u05D0\u05D5\u05E8 \u05D9\u05D4\u05D5\u05D3\u05D4', '\u05DB\u05E4\u05E8 \u05D9\u05D5\u05E0\u05D4', '\u05E7\u05E8\u05D9\u05EA \u05D0\u05D5\u05E0\u05D5', '\u05D3\u05D9\u05DE\u05D5\u05E0\u05D4', '\u05D2\u05D1\u05E2\u05EA\u05D9\u05D9\u05DD', '\u05D1\u05E0\u05D9 \u05D1\u05E8\u05E7', '\u05E0\u05E9\u05E8', 'קריית שמונה', 'עפולה', 'עתלית',
      'בית שמש',
    ],
    cacheStatus: {
      ...Object.fromEntries(GOV_RESOURCES.map(r => [
        r.city,
        cache.govCache[r.id] ? `${cache.govCache[r.id].data.length} shelters` : 'not loaded',
      ])),
      ...Object.fromEntries(GEOJSON_RESOURCES.map(r => [
        r.city,
        cache.geojsonCache[r.url] ? `${cache.geojsonCache[r.url].data.length} shelters` : 'not loaded',
      ])),
    },
  });
});

module.exports = router;
