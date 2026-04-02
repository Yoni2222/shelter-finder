const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set GOOGLE_API_KEY env variable');
  process.exit(1);
}

// Kiryat Gat bounding box
const BOUNDS = { latMin: 31.59, latMax: 31.63, lonMin: 34.75, lonMax: 34.79 };

// City centroid to reject
const CENTROID = { lat: 31.6104718, lon: 34.7722948 };

const shelters = [
  { name: 'מקלט א', street: 'צופר', number: '7', neighborhood: 'שער דרום' },
  { name: 'מקלט ב', street: 'באר אורה', number: '17', neighborhood: 'שער דרום' },
  { name: 'מקלט ג', street: 'קטורה', number: '17', neighborhood: 'שער דרום' },
  { name: 'מקלט ד', street: 'שיזפון', number: '17', neighborhood: 'שער דרום' },
  { name: 'מקלט ה', street: 'גרופית', number: '14', neighborhood: 'שער דרום' },
  { name: 'מקלט ו', street: 'חלוצה', number: '8', neighborhood: 'שער דרום' },
  { name: 'מקלט כג', street: 'רותם', number: '27', neighborhood: null },
  { name: 'מקלט כד', street: 'ימין', number: '16', neighborhood: null },
  { name: 'מקלט כה', street: 'מבצע עובדה', number: '29', neighborhood: null },
  { name: 'מקלט כו', street: 'מבצע חורב', number: '23', neighborhood: null },
  { name: 'מקלט כז', street: 'מבצע יואב', number: '6', neighborhood: null },
  { name: 'מקלט כח', street: 'מבצע חירם', number: '20', neighborhood: null },
  { name: 'מקלט כט', street: 'מבצע נחשון', number: '23', neighborhood: null },
  { name: 'מקלט 33', street: 'מבוא תש"ח', number: '88', neighborhood: null },
  { name: 'מקלט 200', street: 'יששכר', number: '9', neighborhood: null },
  { name: 'מקלט 203', street: 'מנשה', number: '3', neighborhood: null },
  { name: 'מקלט 204', street: 'מנשה', number: '6', neighborhood: null },
  { name: 'מקלט 205', street: 'מנשה', number: '6', neighborhood: null },
  { name: 'מקלט 206', street: 'גד', number: '11', neighborhood: null },
  { name: 'מקלט 12', street: 'התבור', number: '2', neighborhood: null },
];

function buildVariations(s) {
  const variations = [];
  // Use both spellings of Kiryat Gat
  const cities = ['קריית גת', 'קרית גת'];

  for (const city of cities) {
    // Full address with street number
    variations.push(`${s.street} ${s.number}, ${city}`);
    variations.push(`רחוב ${s.street} ${s.number}, ${city}`);
    variations.push(`${s.street} ${s.number}, ${city}, ישראל`);
    variations.push(`רחוב ${s.street} ${s.number}, ${city}, ישראל`);

    if (s.neighborhood) {
      variations.push(`${s.street} ${s.number}, ${s.neighborhood}, ${city}`);
      variations.push(`${s.street} ${s.number}, שכונת ${s.neighborhood}, ${city}`);
    }

    // Street only (no number) - for route-level geocoding
    variations.push(`רחוב ${s.street}, ${city}`);
    variations.push(`${s.street}, ${city}`);
  }

  return variations;
}

function geocode(address) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}&language=he&region=il`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function inBounds(lat, lon) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax;
}

function isCentroid(lat, lon) {
  // Reject if within ~50m of city centroid
  return Math.abs(lat - CENTROID.lat) < 0.0005 && Math.abs(lon - CENTROID.lon) < 0.0005;
}

function isStreetLevel(result) {
  const locType = result.geometry.location_type;
  // Accept ROOFTOP (exact), RANGE_INTERPOLATED (between two points), GEOMETRIC_CENTER (of a road)
  // Reject APPROXIMATE (city/neighborhood level)
  return locType !== 'APPROXIMATE';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const results = [];
  let okCount = 0;
  let failCount = 0;

  for (const shelter of shelters) {
    const variations = buildVariations(shelter);
    let found = false;

    console.log(`\n--- ${shelter.name} (${shelter.street} ${shelter.number}) ---`);

    for (const query of variations) {
      await sleep(150); // rate limit
      console.log(`  Trying: "${query}"`);
      try {
        const resp = await geocode(query);
        if (resp.status === 'OK' && resp.results.length > 0) {
          const r = resp.results[0];
          const loc = r.geometry.location;
          const locType = r.geometry.location_type;
          const formattedAddr = r.formatted_address;

          // Check: must be street-level, in bounds, and NOT the city centroid
          if (!isStreetLevel(r)) {
            console.log(`  x Rejected (${locType}): ${formattedAddr}`);
            continue;
          }
          if (!inBounds(loc.lat, loc.lng)) {
            console.log(`  x Out of bounds: ${loc.lat}, ${loc.lng}`);
            continue;
          }
          if (isCentroid(loc.lat, loc.lng)) {
            console.log(`  x City centroid: ${loc.lat}, ${loc.lng}`);
            continue;
          }

          console.log(`  OK [${locType}]: ${loc.lat}, ${loc.lng} -- ${formattedAddr}`);
          results.push({
            name: shelter.name,
            originalAddress: `${shelter.street} ${shelter.number}`,
            lat: loc.lat,
            lon: loc.lng,
            formattedAddress: formattedAddr,
            locationType: locType,
            queryUsed: query,
          });
          found = true;
          okCount++;
          break;
        } else {
          console.log(`  x ${resp.status}`);
        }
      } catch (err) {
        console.log(`  x Error: ${err.message}`);
      }
    }

    if (!found) {
      console.log(`  ** FAIL: No street-level result for ${shelter.name}`);
      results.push({
        name: shelter.name,
        originalAddress: `${shelter.street} ${shelter.number}`,
        lat: null,
        lon: null,
        formattedAddress: null,
        locationType: null,
        queryUsed: null,
        status: 'FAILED',
      });
      failCount++;
    }
  }

  const outputPath = path.join(__dirname, 'kiryat-gat-missing-output.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\n========================================`);
  console.log(`DONE: ${okCount} OK, ${failCount} FAIL`);
  console.log(`Output: ${outputPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
