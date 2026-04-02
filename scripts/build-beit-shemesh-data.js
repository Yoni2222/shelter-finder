'use strict';
/**
 * Build Beit Shemesh shelters data from municipality list.
 * Source: https://www.betshemesh.muni.il/100161/
 *
 * Run: node scripts/build-beit-shemesh-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = 'בית שמש';

// Clean address: strip א' suffix (entrance marker) and מלחמה (wartime marker)
function cleanAddress(addr) {
  return addr
    .replace(/\s*א['׳]\s*$/, '')   // strip א' at end
    .replace(/\s*מלחמה\s*/g, '')    // strip מלחמה
    .trim();
}

// Each entry: [idSuffix, street, houseNum, neighborhood]
// houseNum can be '' for street-only
const SHELTERS = [
  // מרכז (Center)
  ['1',   'אבא נעמת',        '2',  'מרכז'],
  ['5',   'הרצל',             '10', 'מרכז'],
  ['6',   'הרצל',             '20', 'מרכז'],
  ['7',   'מורדי הגטאות',     '7',  'מרכז'],
  ['9',   'בן צבי',           '24', 'מרכז'],
  ['s1',  'סמטת ויצו',        '3',  'מרכז'],
  ['32',  'הרצל',             '30', 'מרכז'],

  // צפון (North)
  ['2',   'החלוצים',          '24', 'צפון'],
  ['r1',  'רביצקי',           '1',  'צפון'],
  ['4',   'הוותיקים',         '1',  'צפון'],
  ['14',  'דם המכבים',        '9',  'צפון'],
  ['15',  'העלייה',           '11', 'צפון'],
  ['16',  'המעפילים',         '12', 'צפון'],
  ['18',  'בן גרא',           '',   'צפון'],
  ['19',  'ביאליק',           '32', 'צפון'],
  ['20',  'סמטת אלעזרי',      '1',  'צפון'],
  ['29',  'גור אריה',         '7',  'צפון'],
  // 30 skipped (duplicate of 29)
  ['31',  'מעלה יאיר',        '1',  'צפון'],
  ['45',  'הצבע',             '2',  'צפון'],

  // רמת לח"י (Ramat Lechi)
  ['24',  'יהודה המכבי',      '4',  'רמת לח"י'],
  ['25',  'רבי מאיר בן לולו', '2',  'רמת לח"י'],

  // שכונת הגפן (Shkunat HaGefen)
  ['10',  'שביל השקד',        '38', 'שכונת הגפן'],
  ['12',  'אלנקווה',          '17', 'שכונת הגפן'],
  ['13',  'אלנקווה',          '11', 'שכונת הגפן'],
  ['41',  'אלנקווה',          '6',  'שכונת הגפן'],
  ['42',  'הגפן',             '3',  'שכונת הגפן'],
  ['43',  'הגפן',             '24', 'שכונת הגפן'],
  ['53',  'הגפן',             '23', 'שכונת הגפן'],

  // הנרקיס (HaNarkis)
  ['60',  'הנרקיס',           '2',  'הנרקיס'],
  ['61',  'הנרקיס',           '6',  'הנרקיס'],
  ['62',  'הנרקיס',           '8',  'הנרקיס'],
  ['63',  'הנרקיס',           '10', 'הנרקיס'],
  ['64',  'הנרקיס',           '12', 'הנרקיס'],
  ['65',  'הנרקיס',           '14', 'הנרקיס'],
  ['66',  'הנרקיס',           '18', 'הנרקיס'],
  ['67',  'הנרקיס',           '24', 'הנרקיס'],
  ['68',  'הנרקיס',           '26', 'הנרקיס'],

  // הקרייה החרדית (HaKirya HaCharedit)
  ['50',  'הרב מבריסק',       '2',  'הקרייה החרדית'],
  ['51',  'הרב מבריסק',       '10', 'הקרייה החרדית'],
  ['27',  'מעשי חייא',        '1',  'הקרייה החרדית'],
  ['33',  'מעשי חייא',        '13', 'הקרייה החרדית'],
  ['34',  'רשי',              '11', 'הקרייה החרדית'],
  ['47',  'רשי',              '15', 'הקרייה החרדית'],
  ['48',  'שערי שמיים',       '2',  'הקרייה החרדית'],
  ['49',  'שערי שמיים',       '4',  'הקרייה החרדית'],
];

// Migoniyot
const MIGONIYOT = [
  ['m1',  'הנשיא',            '51'],
  ['m2',  'ביאליק',           '14'],
  ['m3',  'רמבם',             '14'],
  ['m4',  'רמבם',             '25'],
  ['m5',  'בן גרא',           '2'],
  ['m6',  'אבא נעמת',        '12'],
  ['m7',  'הצבע',             '2'],
  ['m11', 'אביי',             '28'],
  ['m12', 'רב המנונא',        '11'],
];

async function geocode(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const type = data.results[0].geometry.location_type;
    if (type === 'APPROXIMATE') return null;
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address, type };
  }
  return null;
}

async function main() {
  const shelters = [];
  let success = 0, fail = 0, skipped = 0;

  console.log('=== Beit Shemesh Shelters ===\n');

  // Process shelters
  for (const [idSuffix, street, houseNum, neighborhood] of SHELTERS) {
    const cleanStreet = cleanAddress(street);
    const addrLocal = houseNum ? `${cleanStreet} ${houseNum}` : cleanStreet;
    const query = `${addrLocal}, ${CITY}, ישראל`;

    const geo = await geocode(query);
    if (geo) {
      shelters.push({
        id: `beit_shemesh_${idSuffix}`,
        lat: geo.lat,
        lon: geo.lon,
        name: `מקלט ${idSuffix} - ${neighborhood}`,
        address: `${addrLocal}, ${CITY}`,
        city: CITY,
        neighborhood,
        capacity: '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log(`  OK  ${idSuffix}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      // For r1 (רביצקי), skip on failure as instructed
      if (idSuffix === 'r1') {
        skipped++;
        console.log(`  SKIP ${idSuffix}: ${addrLocal} -> geocoding failed (as instructed)`);
      } else {
        fail++;
        console.log(`  FAIL ${idSuffix}: ${addrLocal} -> NO RESULT`);
      }
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process migoniyot
  console.log('\n=== Migoniyot ===\n');
  for (const [idSuffix, street, houseNum] of MIGONIYOT) {
    const cleanStreet = cleanAddress(street);
    const addrLocal = houseNum ? `${cleanStreet} ${houseNum}` : cleanStreet;
    const query = `${addrLocal}, ${CITY}, ישראל`;

    const geo = await geocode(query);
    if (geo) {
      shelters.push({
        id: `beit_shemesh_${idSuffix}`,
        lat: geo.lat,
        lon: geo.lon,
        name: `מיגונית ${idSuffix.replace('m', '')}`,
        address: `${addrLocal}, ${CITY}`,
        city: CITY,
        capacity: '',
        type: 'מיגונית',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log(`  OK  ${idSuffix}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`  FAIL ${idSuffix}: ${addrLocal} -> NO RESULT`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  const total = SHELTERS.length + MIGONIYOT.length;
  console.log(`\nTotal: ${success} geocoded, ${fail} failed, ${skipped} skipped out of ${total}`);

  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'beit-shemesh-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
