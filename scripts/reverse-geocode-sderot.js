const fs = require('fs');
const path = require('path');

const API_KEY = 'AIzaSyB6rgqJ418JtjyhYGzamDqpFt_ugYBMD_g';
const INPUT = path.join(__dirname, 'sderot-govmap-output.json');
const OUTPUT_SCRIPTS = path.join(__dirname, 'sderot-output.json');
const OUTPUT_DATA = path.join(__dirname, '..', 'data', 'sderot-shelters.json');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function reverseGeocode(lat, lon) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${API_KEY}&language=he&result_type=street_address|route`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    return { address: '', street: '', number: '' };
  }

  const result = data.results[0];
  const components = result.address_components || [];

  let street = '';
  let number = '';

  for (const comp of components) {
    if (comp.types.includes('route')) {
      street = comp.long_name;
    }
    if (comp.types.includes('street_number')) {
      number = comp.long_name;
    }
  }

  const address = number ? `${street} ${number}` : street;
  return { address, street, number };
}

async function main() {
  const shelters = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  console.log(`Loaded ${shelters.length} shelters from input file.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    const seqNum = i + 1;

    try {
      const { address } = await reverseGeocode(s.lat, s.lon);

      s.id = `שדרות-${seqNum}`;
      s.name = `מקלט ${seqNum}`;

      if (address) {
        s.address = address;
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      s.id = `שדרות-${seqNum}`;
      s.name = `מקלט ${seqNum}`;
      failCount++;
      console.error(`  Error for shelter ${seqNum}: ${err.message}`);
    }

    if (i % 20 === 0) {
      process.stdout.write(`  Processed ${i + 1}/${shelters.length}...\r`);
    }

    await delay(200);
  }

  console.log(`\n\n=== STATS ===`);
  console.log(`Total shelters: ${shelters.length}`);
  console.log(`Got address:    ${successCount}`);
  console.log(`Failed:         ${failCount}`);

  // Write outputs
  const json = JSON.stringify(shelters, null, 2);
  fs.writeFileSync(OUTPUT_SCRIPTS, json, 'utf-8');
  console.log(`\nWrote: ${OUTPUT_SCRIPTS}`);

  fs.mkdirSync(path.dirname(OUTPUT_DATA), { recursive: true });
  fs.writeFileSync(OUTPUT_DATA, json, 'utf-8');
  console.log(`Wrote: ${OUTPUT_DATA}`);

  // Print samples
  console.log(`\n=== SAMPLE ENTRIES ===`);
  const samples = shelters.filter(s => s.address).slice(0, 5);
  for (const s of samples) {
    console.log(`  ${s.id} | ${s.name} | ${s.address} | (${s.lat}, ${s.lon})`);
  }
  const failed = shelters.filter(s => !s.address).slice(0, 3);
  if (failed.length) {
    console.log(`\n=== SAMPLE FAILURES ===`);
    for (const s of failed) {
      console.log(`  ${s.id} | ${s.name} | (${s.lat}, ${s.lon})`);
    }
  }
}

main().catch(console.error);
