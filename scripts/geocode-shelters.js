// Generic shelter geocoder
// Usage: node geocode-shelters.js <input.json> <output.json>
// Input format: [{name, address, city, type, category, source, ...extra}]
// Output format: same + lat, lon fields (entries that fail geocoding are dropped)

const fs = require('fs');
const https = require('https');

const [,, inputFile, outputFile] = process.argv;
if (!inputFile || !outputFile) {
  console.error('Usage: node geocode-shelters.js <input.json> <output.json>');
  process.exit(1);
}

const shelters = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
console.log(`Loaded ${shelters.length} shelters from ${inputFile}`);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function geocodeOnce(address) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=il`;
    https.get(url, { headers: { 'User-Agent': 'ShelterFinderBuilder/1.0' } }, res => {
      if (res.statusCode === 429 || res.statusCode === 503) {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => reject(new Error('RATE_LIMITED_' + res.statusCode)));
        return;
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          resolve(results.length > 0 ? results[0] : null);
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
      if (e.message.startsWith('RATE_LIMITED') || e.message === 'PARSE_ERROR') {
        const wait = 3000 * (attempt + 1);
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
          lat: parseFloat(geo.lat),
          lon: parseFloat(geo.lon),
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

    await sleep(1200);
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('\nDone: ' + ok + ' geocoded, ' + fail + ' failed. Saved to ' + outputFile);
}

main().catch(function(e) { console.error(e); process.exit(1); });
