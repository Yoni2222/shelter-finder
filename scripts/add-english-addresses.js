// Fills in the English form of each shelter's address.
//
//   node scripts/add-english-addresses.js          # every city
//   node scripts/add-english-addresses.js haifa    # one city, to cost a pilot
//
// Requires GOOGLE_API_KEY with the Geocoding API enabled.
//
// Approach: FORWARD geocode the Hebrew address ("מרכוס 11, חיפה") asking for
// English. An earlier version reverse-geocoded the coordinates instead, which
// returns whatever Google finds nearest to that point - so "מרכוס 11" came
// back as "David Ben Harush St 3" and 28% of records ended up with a house
// number that did not match the Hebrew address at all.
//
// Forward geocoding can still resolve to the wrong place, so the result is
// only accepted when it lands within MAX_DRIFT_M of the stored coordinates.
// Otherwise we fall back to reverse geocoding, which is at least honest about
// where the shelter physically is.

const fs = require('fs');
const https = require('https');
const path = require('path');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_API_KEY'); process.exit(1); }

const HEBREW = /[֐-׿]/;
const MAX_DRIFT_M = 400;

const dataDir = path.join(process.cwd(), 'data');
const only = process.argv[2];
const files = fs.readdirSync(dataDir)
  .filter(f => f.endsWith('-shelters.json'))
  .filter(f => !only || f.includes(only));

if (files.length === 0) { console.error('No city files match: ' + only); process.exit(1); }

function getJson(url) {
  return new Promise(resolve => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tidy(addr) {
  return addr
    .replace(/, Israel$/, '')
    .replace(/\d{5,7}, /, '')
    .replace(/,\s*\d{5,7}$/, '')
    .trim();
}

/** Geocode the Hebrew address itself, keeping street and number intact. */
async function forwardGeocode(address, city, lat, lon) {
  const q = encodeURIComponent(`${address}, ${city}, Israel`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${API_KEY}&language=en&region=il`;
  const j = await getJson(url);
  if (!j || j.status !== 'OK' || !j.results.length) return null;

  const best = j.results[0];
  const loc = best.geometry && best.geometry.location;
  if (!loc) return null;

  // Reject a match that points somewhere else entirely.
  if (haversineM(lat, lon, loc.lat, loc.lng) > MAX_DRIFT_M) return null;

  return tidy(best.formatted_address);
}

/** Last resort: describe wherever the coordinates actually are. */
async function reverseGeocode(lat, lon) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${API_KEY}&language=en&region=il`;
  const j = await getJson(url);
  if (!j || j.status !== 'OK' || !j.results.length) return null;
  return tidy(j.results[0].formatted_address);
}

function houseNumber(s) {
  const m = String(s || '').match(/\d+/);
  return m ? m[0] : null;
}

/** Records worth spending an API call on. */
function needsWork(s) {
  const en = (s.addressEn || '').trim();
  if (!en) return true;                 // never filled
  if (HEBREW.test(en)) return true;     // came back in Hebrew
  const hn = houseNumber(s.address), en_hn = houseNumber(en);
  if (hn && en_hn && hn !== en_hn) return true;  // number drifted
  return false;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function processFile(file) {
  const filePath = path.join(dataDir, file);
  const shelters = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(shelters)) return { fwd: 0, rev: 0, failed: 0 };

  const city = file.replace('-shelters.json', '');
  let fwd = 0, rev = 0, failed = 0, calls = 0;

  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    if (!needsWork(s)) continue;

    let out = null;
    const addr = (s.address || '').trim();

    if (addr) {
      out = await forwardGeocode(addr, s.city || city, s.lat, s.lon);
      calls++;
      if (out) fwd++;
    }

    if (!out) {
      out = await reverseGeocode(s.lat, s.lon);
      calls++;
      if (out) rev++;
    }

    if (out && !HEBREW.test(out)) s.addressEn = out;
    else failed++;

    if (calls % 25 === 0) process.stdout.write(`  [${city}] ${i + 1}/${shelters.length}\r`);
    await sleep(50);
  }

  if (fwd || rev) fs.writeFileSync(filePath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`  ${city}: ${fwd} from address, ${rev} from coordinates, ${failed} unresolved (${calls} API calls)`);
  return { fwd, rev, failed };
}

async function main() {
  console.log(`Processing ${files.length} city file(s)...`);
  let fwd = 0, rev = 0, failed = 0;
  for (const file of files) {
    const r = await processFile(file);
    fwd += r.fwd; rev += r.rev; failed += r.failed;
  }
  console.log(`\nDone. ${fwd} matched the recorded address, ${rev} fell back to coordinates, ${failed} unresolved.`);
}

main().catch(e => console.error(e));
