'use strict';
/**
 * Build Yehud-Monosson shelters data from municipality website.
 * Source: https://yehud-monosson.muni.il/רשימת-מקלטים-פתוחים/
 *
 * Run: node scripts/build-yehud-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = 'יהוד';
const CITY_EN = 'Yehud';

// ── Public shelters (Yehud) ──
const PUBLIC_SHELTERS = [
  [102, 'אלפרט', '16'],
  [503, 'אנילביץ', '17'],
  [504, 'גורדון', '9'],
  [302, 'יוספטל', '7'],
  [701, 'רמז', '17'],
  [506, 'הורדים', '43'],
  [104, 'טננבאום', '15'],
  [501, 'יונה', '2'],
  [502, 'יצחק שדה', '11'],
  [105, 'מוהליבר', '76'],
  [106, 'מוהליבר', '106'],
  [110, 'נורדאו', '11'],
  [305, 'סעדיה חתוכה', '25'],
  [111, 'צוקרמן', '43'],
  [108, 'שטרית בכור', '7'],
  [702, 'שפירא', '14'],
];

// ── Monosson public shelters ──
const MONOSSON_PUBLIC_SHELTERS = [
  [803, 'אלמוג', '11'],
  [802, 'שנהב', '14'],
  [806, 'פנינים', '2'],
];

// ── Migoniyot (protected spaces) ──
const MIGONIYOT = [
  [2503, 'רם כהן', '5', 'מיגונית 3'],
  [2504, 'רם כהן', '5', 'מיגונית 4'],
  [2508, 'עצמאות', '8', 'מיגונית 8'],
];

// ── School shelters ──
const SCHOOL_SHELTERS = [
  [507, "ז'בוטינסקי", '28', 'בי"ס הרצל', null],
  [101, 'בן צבי', '12', 'בי"ס יגאל אלון', null],
  [306, 'קדושי מצרים', '23', 'בי"ס יהודה הלוי', null],
  [103, 'סירקין', '8', 'בי"ס רמז', null],
  [801, 'שוהם', '1', 'בי"ס אורנים', null],
  [307, 'חנה סנש', '12', 'גן אלון וכלנית', null],
  [308, 'ביל"ו', '4', 'גן אשל', 'ביאליק'],
  [309, 'קדושי מצרים', '32', 'גן הדר', null],
  [301, 'סעדיה חתוכה', '42', 'גן לוטם וחצב', null],
  [505, 'הרצל', '22', 'גן שרה וארז', null],
  [107, 'מוהליבר', '40', 'מתחם גני ילדים', null],
  [109, 'נתן יונתן', '1', 'תיכון מקיף יהוד', null],
];

// ── Private/commercial shelters (category: public) ──
const PRIVATE_SHELTERS = [
  [904, 'שקד', '30', 'בנק הפועלים'],
  [901, 'משה דיין', '3', 'קניון סביונים'],
  [905, 'שוהם פינת פנינים', '', 'מרכז מסחרי מונוסון'],
];

// English fallback address map
const EN_FALLBACK = {
  'אלפרט': 'Alpert',
  'אנילביץ': 'Anilewicz',
  'גורדון': 'Gordon',
  'יוספטל': 'Yoseftal',
  'רמז': 'Remez',
  'הורדים': 'HaVradim',
  'טננבאום': 'Tanenbaum',
  'יונה': 'Yona',
  'יצחק שדה': 'Yitzhak Sade',
  'מוהליבר': 'Mohilever',
  'נורדאו': 'Nordau',
  'סעדיה חתוכה': 'Saadia Chatukha',
  'צוקרמן': 'Zuckerman',
  'שטרית בכור': 'Shitrit Bechor',
  'שפירא': 'Shapira',
  'אלמוג': 'Almog',
  'שנהב': 'Shenhav',
  'פנינים': 'Pninim',
  'רם כהן': 'Ram Cohen',
  'עצמאות': 'Atzmaut',
  "ז'בוטינסקי": 'Jabotinsky',
  'בן צבי': 'Ben Zvi',
  'קדושי מצרים': 'Kdoshei Mitzraim',
  'סירקין': 'Sirkin',
  'שוהם': 'Shoham',
  'חנה סנש': 'Hannah Senesh',
  'ביל"ו': 'Bilu',
  'ביאליק': 'Bialik',
  'הרצל': 'Herzl',
  'נתן יונתן': 'Natan Yonatan',
  'שקד': 'Shaked',
  'משה דיין': 'Moshe Dayan',
  'שוהם פינת פנינים': 'Shoham corner Pninim',
};

// Manual coordinate overrides for addresses Google can't resolve in Yehud
const MANUAL_COORDS = {
  'עצמאות 8': { lat: 32.0337, lon: 34.8918, formatted: 'Atzmaut St 8, Yehud-Monosson, Israel' },
};

// Yehud bounding box — reject geocode results outside this area
const YEHUD_BOUNDS = { latMin: 32.020, latMax: 32.045, lonMin: 34.860, lonMax: 34.910 };

function inYehudBounds(lat, lon) {
  return lat >= YEHUD_BOUNDS.latMin && lat <= YEHUD_BOUNDS.latMax &&
         lon >= YEHUD_BOUNDS.lonMin && lon <= YEHUD_BOUNDS.lonMax;
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const type = data.results[0].geometry.location_type;
    if (type === 'APPROXIMATE') return null;
    // Reject results outside Yehud bounds (wrong city)
    if (!inYehudBounds(loc.lat, loc.lng)) {
      console.log(`  [bounds] Rejected ${loc.lat},${loc.lng} (${data.results[0].formatted_address})`);
      return null;
    }
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address, type };
  }
  return null;
}

async function geocodeWithFallback(street, houseNum, geocodeStreet) {
  const actualStreet = geocodeStreet || street;
  const addrLocal = houseNum ? `${actualStreet} ${houseNum}` : actualStreet;

  // Check manual coordinate overrides first
  const manualKey = houseNum ? `${street} ${houseNum}` : street;
  if (MANUAL_COORDS[manualKey]) {
    console.log(`  [manual] Using manual coords for ${manualKey}`);
    return { geo: MANUAL_COORDS[manualKey], addrLocal };
  }

  const fullAddr = `${addrLocal}, ${CITY}, ישראל`;

  let geo = await geocode(fullAddr);
  if (geo) return { geo, addrLocal };

  // Try English fallback
  const enStreet = EN_FALLBACK[actualStreet] || EN_FALLBACK[street];
  if (enStreet) {
    const enAddr = houseNum ? `${enStreet} ${houseNum}, ${CITY_EN}, Israel` : `${enStreet}, ${CITY_EN}, Israel`;
    geo = await geocode(enAddr);
    if (geo) return { geo, addrLocal };
  }

  return { geo: null, addrLocal };
}

async function main() {
  const shelters = [];
  let success = 0, fail = 0;

  // Process public shelters (Yehud)
  console.log('=== Public Shelters (Yehud) ===');
  for (const [num, street, houseNum] of PUBLIC_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `yehud_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: `מקלט ${num}`,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
      });
      success++;
      console.log(`OK ${num}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${num}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process Monosson public shelters
  console.log('\n=== Public Shelters (Monosson) ===');
  for (const [num, street, houseNum] of MONOSSON_PUBLIC_SHELTERS) {
    const addrLocal = houseNum ? `${street} ${houseNum}` : street;
    const fullAddr = `${addrLocal}, מונוסון, ישראל`;

    let geo = await geocode(fullAddr);
    if (!geo) {
      const yehudAddr = `${addrLocal}, ${CITY}, ישראל`;
      geo = await geocode(yehudAddr);
    }
    if (!geo) {
      const enStreet = EN_FALLBACK[street];
      if (enStreet) {
        const enAddr = `${enStreet} ${houseNum}, Yehud-Monosson, Israel`;
        geo = await geocode(enAddr);
      }
    }

    if (geo) {
      shelters.push({
        id: `yehud_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: `מקלט ${num}`,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
      });
      success++;
      console.log(`OK ${num}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${num}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process migoniyot
  console.log('\n=== Migoniyot ===');
  for (const [num, street, houseNum, migName] of MIGONIYOT) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `yehud_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: migName,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
      });
      success++;
      console.log(`OK ${migName}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${migName}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process school shelters
  console.log('\n=== School Shelters ===');
  for (const [num, street, houseNum, schoolName, geocodeStreet] of SCHOOL_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum, geocodeStreet);
    if (geo) {
      shelters.push({
        id: `yehud_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: schoolName,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY, capacity: '', type: 'school',
        source: 'gov', category: 'school', addressEn: geo.formatted,
      });
      success++;
      console.log(`OK ${schoolName}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${schoolName}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process private/commercial shelters
  console.log('\n=== Private/Commercial Shelters ===');
  for (const [num, street, houseNum, placeName] of PRIVATE_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `yehud_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: placeName,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
      });
      success++;
      console.log(`OK ${placeName}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${placeName}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  const total = PUBLIC_SHELTERS.length + MONOSSON_PUBLIC_SHELTERS.length + MIGONIYOT.length + SCHOOL_SHELTERS.length + PRIVATE_SHELTERS.length;
  console.log(`\nTotal: ${success} geocoded, ${fail} failed out of ${total}`);

  const outPath = path.join(__dirname, '..', 'data', 'yehud-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
