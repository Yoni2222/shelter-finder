// Generic shelter geocoder — Google Maps Geocoding API
// Usage: GOOGLE_API_KEY=... node geocode-shelters.js <input.json> <output.json>
// Input format: [{name, address, city, type, category, source, ...extra}]
// Output format: same + lat, lon fields (entries that fail geocoding are dropped)

const fs = require('fs');
const https = require('https');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable is required');
  console.error('Usage: GOOGLE_API_KEY=your_key node geocode-shelters.js <input.json> <output.json>');
  process.exit(1);
}

const [,, inputFile, outputFile] = process.argv;
if (!inputFile || !outputFile) {
  console.error('Usage: GOOGLE_API_KEY=... node geocode-shelters.js <input.json> <output.json>');
  process.exit(1);
}

const shelters = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
console.log(`Loaded ${shelters.length} shelters from ${inputFile}`);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function geocodeOnce(address) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.results.length > 0) {
            const loc = result.results[0].geometry.location;
            resolve({ lat: loc.lat, lon: loc.lng, formatted: result.results[0].formatted_address });
          } else if (result.status === 'OVER_QUERY_LIMIT') {
            reject(new Error('RATE_LIMITED'));
          } else {
            resolve(null); // ZERO_RESULTS or other non-error status
          }
        } catch (e) { reject(new Error('PARSE_ERROR')); }
      });
    }).on('error', reject);
  });
}

async function geocode(address, retries) {
  retries = retries || 3;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await geocodeOnce(address);
    } catch (e) {
      if (e.message === 'RATE_LIMITED' || e.message === 'PARSE_ERROR') {
        const wait = 2000 * (attempt + 1);
        console.log('    Retrying in ' + (wait/1000) + 's (attempt ' + (attempt+1) + '/' + retries + ')...');
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
  return null;
}

async function main() {
  const results = [];
  let ok = 0, fail = 0;

  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    const query = s.address + ', ' + s.city;

    try {
      const geo = await geocode(query);
      if (geo) {
        results.push({
          id: (s.cityKey || s.city) + '-' + (i + 1),
          lat: geo.lat,
          lon: geo.lon,
          name: s.name,
          address: s.address,
          city: s.city,
          neighborhood: s.neighborhood || '',
          type: s.type || 'מקלט ציבורי',
          source: 'gov',
          category: s.category || 'public',
        });
        ok++;
        console.log('  [' + (i+1) + '/' + shelters.length + '] OK ' + s.name + ' -> ' + geo.lat + ', ' + geo.lon);
      } else {
        fail++;
        console.log('  [' + (i+1) + '/' + shelters.length + '] FAIL ' + s.name + ' (' + query + ') - not found');
      }
    } catch (e) {
      fail++;
      console.log('  [' + (i+1) + '/' + shelters.length + '] FAIL ' + s.name + ' - error: ' + e.message);
    }

    // Google allows ~50 requests/sec, but let's be polite
    await sleep(200);
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('\nDone: ' + ok + ' geocoded, ' + fail + ' failed. Saved to ' + outputFile);
}

main().catch(function(e) { console.error(e); process.exit(1); });
