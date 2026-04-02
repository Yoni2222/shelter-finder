"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const GOOGLE_API_KEY = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/GOOGLE_MAPS_API_KEY=(.*)/)[1].trim();
const BOUNDS = { latMin: 32.15, latMax: 32.22, lonMin: 34.87, lonMax: 34.95 };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function googleGeocode(address, language) {
  return new Promise((resolve, reject) => {
    const url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(address) + "&key=" + GOOGLE_API_KEY + "&language=" + language + "&region=il";
    https.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.status === "OK" && result.results.length > 0) {
            const r = result.results[0];
            const loc = r.geometry.location;
            resolve({ lat: loc.lat, lon: loc.lng, formatted: r.formatted_address, location_type: r.geometry.location_type });
          } else if (result.status === "OVER_QUERY_LIMIT") {
            reject(new Error("RATE_LIMITED"));
          } else { resolve(null); }
        } catch (e) { reject(new Error("PARSE_ERROR")); }
      });
    }).on("error", reject);
  });
}

function reverseGeocode(lat, lon, language) {
  return new Promise((resolve, reject) => {
    const url = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + lat + "," + lon + "&key=" + GOOGLE_API_KEY + "&language=" + language + "&region=il";
    https.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.status === "OK" && result.results.length > 0) { resolve(result.results[0].formatted_address); }
          else { resolve(null); }
        } catch (e) { reject(new Error("PARSE_ERROR")); }
      });
    }).on("error", reject);
  });
}

async function geocodeWithRetry(address, language, retries) {
  retries = retries || 3;
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await googleGeocode(address, language); }
    catch (e) {
      if (e.message === "RATE_LIMITED" || e.message === "PARSE_ERROR") {
        const wait = 2000 * (attempt + 1);
        console.log("    Retrying in " + (wait/1000) + "s (attempt " + (attempt+1) + "/" + retries + ")...");
        await sleep(wait);
      } else { throw e; }
    }
  }
  return null;
}

async function reverseGeocodeWithRetry(lat, lon, language, retries) {
  retries = retries || 3;
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await reverseGeocode(lat, lon, language); }
    catch (e) {
      if (e.message === "RATE_LIMITED" || e.message === "PARSE_ERROR") {
        const wait = 2000 * (attempt + 1);
        console.log("    Retrying reverse geocode in " + (wait/1000) + "s...");
        await sleep(wait);
      } else { throw e; }
    }
  }
  return null;
}

function isInBounds(lat, lon) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax;
}
function coordKey(lat, lon) { return lat.toFixed(5) + "_" + lon.toFixed(5); }
function shortenEnAddress(full) {
  if (!full) return "";
  let s = full.replace(/, Israel$/i, "").trim();
  s = s.replace(/,?\s*\d{5,7}\s*$/, "").trim();
  s = s.replace(/,\s*$/, "").trim();
  return s;
}

function normalizeAddress(addr) {
  return addr.replace(/[,\s]+/g, " ").trim();
}

async function main() {
  // 1. Load existing shelters
  const sheltersPath = path.join(__dirname, "..", "data", "kfar-saba-shelters.json");
  const existingShelters = JSON.parse(fs.readFileSync(sheltersPath, "utf8"));
  console.log("Existing shelters loaded: " + existingShelters.length);

  // 2. Load kindergarten entries
  const kinderPath = path.join(__dirname, "input", "kfar-saba-kindergartens.json");
  const kindergartens = JSON.parse(fs.readFileSync(kinderPath, "utf8"));
  console.log("Kindergarten entries loaded: " + kindergartens.length);

  // 3. Build set of existing normalized addresses for dedup
  const existingAddresses = new Set();
  for (const s of existingShelters) {
    if (s.address) existingAddresses.add(normalizeAddress(s.address));
  }

  // 4. Build coordinate set from existing shelters
  const seenCoords = new Set();
  for (const s of existingShelters) {
    if (s.lat && s.lon) seenCoords.add(coordKey(s.lat, s.lon));
  }

  // 5. Filter out kindergartens whose address already exists
  const newKindergartens = [];
  let skippedExisting = 0;
  for (const k of kindergartens) {
    const normAddr = normalizeAddress(k.address);
    if (existingAddresses.has(normAddr)) {
      skippedExisting++;
      console.log("  SKIP (already exists): " + k.address);
    } else {
      newKindergartens.push(k);
    }
  }
  console.log("Skipped (already in data): " + skippedExisting);
  console.log("New kindergartens to geocode: " + newKindergartens.length);

  // 6. Geocode new kindergartens
  const newShelters = [];
  let ok = 0, fail = 0, filtered = 0, dupes = 0;

  for (let i = 0; i < newKindergartens.length; i++) {
    const k = newKindergartens[i];
    const label = "[" + (i+1) + "/" + newKindergartens.length + "]";
    const geocodeQuery = k.address + " " + "כפר סבא";
    try {
      const geo = await geocodeWithRetry(geocodeQuery, "he");
      if (!geo) { fail++; console.log("  " + label + " FAIL " + k.name + " (" + geocodeQuery + ") - not found"); await sleep(50); continue; }
      if (geo.location_type === "APPROXIMATE") { filtered++; console.log("  " + label + " FILTERED " + k.name + " - location_type APPROXIMATE"); await sleep(50); continue; }
      if (!isInBounds(geo.lat, geo.lon)) { filtered++; console.log("  " + label + " FILTERED " + k.name + " - outside bounds (" + geo.lat + ", " + geo.lon + ")"); await sleep(50); continue; }
      const key = coordKey(geo.lat, geo.lon);
      if (seenCoords.has(key)) { dupes++; console.log("  " + label + " DUPE " + k.name + " - duplicate coords (" + geo.lat + ", " + geo.lon + ")"); await sleep(50); continue; }
      seenCoords.add(key);
      await sleep(50);
      const enFull = await reverseGeocodeWithRetry(geo.lat, geo.lon, "en");
      const addressEn = shortenEnAddress(enFull);
      await sleep(50);
      newShelters.push({
        id: "kfarsaba_" + (existingShelters.length + newShelters.length + 1),
        lat: geo.lat,
        lon: geo.lon,
        name: k.name,
        address: k.address,
        city: "כפר סבא",
        neighborhood: "",
        type: "מקלט גן",
        source: "gov",
        category: "school",
        addressEn: addressEn
      });
      ok++;
      console.log("  " + label + " OK " + k.name + " -> " + geo.lat + ", " + geo.lon + " | " + addressEn);
    } catch (err) { fail++; console.log("  " + label + " ERROR " + k.name + " - " + err.message); }
    await sleep(50);
  }

  // 7. Append new shelters to existing array
  const combined = existingShelters.concat(newShelters);

  // 8. Re-number all IDs sequentially
  combined.forEach(function(r, idx) { r.id = "kfarsaba_" + (idx + 1); });

  // 9. Save combined array back
  fs.writeFileSync(sheltersPath, JSON.stringify(combined, null, 2), "utf8");

  // 10. Print stats
  console.log("");
  console.log("Done!");
  console.log("  Geocoded OK: " + ok);
  console.log("  Failed: " + fail);
  console.log("  Filtered (APPROXIMATE/out-of-bounds): " + filtered);
  console.log("  Duplicates: " + dupes);
  console.log("  Skipped (already in data): " + skippedExisting);
  console.log("  New shelters added: " + newShelters.length);
  console.log("  Total shelters: " + combined.length);
  console.log("  Output: " + sheltersPath);
}
main().catch(function(e) { console.error(e); process.exit(1); });
