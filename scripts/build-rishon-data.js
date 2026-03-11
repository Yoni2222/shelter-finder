'use strict';
/**
 * Build Rishon LeZion shelters data.
 * Source: https://www.rishonlezion.muni.il/Residents/SecurityEmergency/pages/publicshelter.aspx
 * Parses HTML table, then geocodes each address via Nominatim (1.3s rate limit).
 * This takes ~40-50 minutes for ~40-50 addresses.
 *
 * Run: node scripts/build-rishon-data.js
 */

const fetch = require('node-fetch');
const fs = require('fs'), path = require('path');

const RISHON_URL = 'https://www.rishonlezion.muni.il/Residents/SecurityEmergency/pages/publicshelter.aspx';
const NOMINATIM_DELAY_MS = 1300;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseRishonTable(html) {
  const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const rows = [];
  const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRx.exec(html)) !== null) {
    const cells = [];
    const tdRx = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRx.exec(trMatch[1])) !== null) cells.push(strip(tdMatch[1]));
    if (cells.length < 2) continue;
    const [title, address, neighborhood, description] = cells;
    if (!title || (!title.includes('מקלט') && !title.includes('מרחב מוגן'))) continue;
    if (!address || address.length < 3) continue;
    rows.push({ title, address, neighborhood: neighborhood || '', description: description || '' });
  }
  return rows;
}

async function nominatimGeocode(address) {
  const q = address.includes('ישראל') ? address : address + ', ישראל';
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    format: 'json', q, limit: 1,
  })}`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'he,en', 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 8000,
  });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!arr || !arr[0]) return null;
  const lat = parseFloat(arr[0].lat);
  const lon = parseFloat(arr[0].lon);
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

async function main() {
  console.log('Fetching Rishon LeZion shelter page...');
  const res = await fetch(RISHON_URL, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const rows = parseRishonTable(html);
  console.log(`Parsed ${rows.length} shelter rows from HTML`);
  console.log(`Geocoding via Nominatim (${NOMINATIM_DELAY_MS}ms between requests)...`);
  console.log(`Estimated time: ~${Math.ceil(rows.length * NOMINATIM_DELAY_MS / 60000)} minutes`);

  const shelters = [];
  let ok = 0, fail = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Rate limit: wait before each request (except first)
    if (i > 0) await sleep(NOMINATIM_DELAY_MS);

    try {
      const coords = await nominatimGeocode(row.address);
      if (!coords) {
        fail++;
        console.warn(`  [${i+1}/${rows.length}] No result for: "${row.address}"`);
        continue;
      }
      ok++;

      // Parse area/capacity from description
      const areaMatch = row.description.match(/שטח\s+(\d+)/);
      const capMatch  = row.description.match(/כמות אנשים\s*[-–]\s*(\d+)/);
      const area      = areaMatch ? areaMatch[1] : '';
      const capacity  = capMatch  ? capMatch[1]  : '';

      shelters.push({
        id:       `rishon_${i}`,
        lat:      coords.lat,
        lon:      coords.lon,
        name:     row.title,
        address:  row.address.replace(/\s*ראשון לציון\s*$/i, '').trim(),
        city:     'ראשון לציון',
        capacity: capacity ? `${capacity} אנשים` : (area ? `${area} מ"ר` : ''),
        type:     'מקלט ציבורי',
        source:   'gov',
        category: 'public',
      });

      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i+1}/${rows.length} (${ok} ok, ${fail} failed so far)`);
      }
    } catch (e) {
      fail++;
      console.warn(`  [${i+1}/${rows.length}] Geocode error for "${row.address}": ${e.message}`);
    }
  }

  shelters.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  console.log(`\nGeocode results: ${ok} ok, ${fail} failed`);

  const out = path.join(__dirname, '..', 'data', 'rishon-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
