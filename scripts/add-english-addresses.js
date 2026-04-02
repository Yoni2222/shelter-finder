const fs = require('fs');
const https = require('https');
const path = require('path');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_API_KEY'); process.exit(1); }

const dataDir = path.join(process.cwd(), 'data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('-shelters.json'));

function reverseGeocode(lat, lon) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${API_KEY}&language=en&region=il`;
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.status === 'OK' && j.results.length > 0) {
            resolve(j.results[0].formatted_address);
          } else {
            resolve(null);
          }
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processFile(file) {
  const filePath = path.join(dataDir, file);
  const shelters = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const city = file.replace('-shelters.json', '');
  let updated = 0;
  
  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    if (s.addressEn) { updated++; continue; }
    
    const en = await reverseGeocode(s.lat, s.lon);
    if (en) {
      s.addressEn = en.replace(/, Israel$/, '').replace(/\d{7}, /, '');
      updated++;
    }
    
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  [${city}] ${i+1}/${shelters.length}\r`);
    }
    await sleep(50);
  }
  
  fs.writeFileSync(filePath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`  ${city}: ${updated}/${shelters.length} English addresses`);
  return updated;
}

async function main() {
  console.log(`Processing ${files.length} city files...`);
  let total = 0;
  for (const file of files) {
    total += await processFile(file);
  }
  console.log(`\nDone: ${total} English addresses added across ${files.length} cities.`);
}

main().catch(e => console.error(e));
