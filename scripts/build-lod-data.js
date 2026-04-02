'use strict';
/**
 * Build Lod shelters data from municipality website.
 * Source: https://www.lod.muni.il/he/articles/item/5555/
 *
 * Run: node scripts/build-lod-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = 'לוד';
const CITY_EN = 'Lod';

// ── 44 operational (כשיר) public shelters ──
// [municipalityId, rawAddress, cleanStreet, houseNum, neighborhood]
const SHELTERS = [
  ['601', 'גן שרת', 'גן שרת', '', 'נווה זית'],
  ['603', 'אלי כהן 8', 'אלי כהן', '8', 'חסכון ג'],
  ['605', 'החלוץ פינת אלשוילי', 'החלוץ', '', ''],
  ['606B', 'שלמה המלך 63', 'שלמה המלך', '63', 'ממשלתי'],
  ['607', 'הברושים 6', 'הברושים', '6', 'גבעת הזיתים'],
  ['608', 'גושן 1', 'גושן', '1', 'גבעת הזיתים'],
  ['609', 'גלעד 7', 'גלעד', '7', 'גבעת הזיתים'],
  ['610', 'גלעד 17', 'גלעד', '17', 'גבעת הזיתים'],
  ['611', 'גלעד 4', 'גלעד', '4', 'גבעת הזיתים'],
  ['612', 'הורדים 2', 'הורדים', '2', 'גבעת הזיתים'],
  ['613', 'יצחק בן צבי 6', 'יצחק בן צבי', '6', 'נווה זית'],
  ['614', 'האלון 6', 'האלון', '6', 'נווה זית'],
  ['615', 'הרימון 2', 'הרימון', '2', 'נווה זית'],
  ['616', 'מעלות המושבה 14', 'מעלות המושבה', '14', 'נווה זית'],
  ['617', 'אחד העם 5', 'אחד העם', '5', 'נווה זית'],
  ['618', 'הגדוד העברי 9', 'הגדוד העברי', '9', 'מושבה'],
  ['619', 'הגדוד העברי 7', 'הגדוד העברי', '7', 'מושבה'],
  ['620', 'דניאל 35', 'דניאל', '35', 'ממשלתי'],
  ['621', 'אצ"ל 2', 'אצ"ל', '2', 'חסכון א'],
  ['622', 'יוסף שפרינצק 15', 'יוסף שפרינצק', '15', 'חסכון א'],
  ['623', 'יצחק מודעי 13', 'יצחק מודעי', '13', 'חסכון ב'],
  ['625', 'שמשון 14', 'שמשון', '14', 'חסכון ב'],
  ['626', 'מאנגר 3', 'מאנגר', '3', 'ממשלתי'],
  ['627', 'יוסף שילוח 1', 'יוסף שילוח', '1', 'ממשלתי'],
  ['628', 'הורדים 18', 'הורדים', '18', 'ממשלתי'],
  ['629', 'הורדים 8', 'הורדים', '8', 'ממשלתי'],
  ['631', 'שלמה המלך 31', 'שלמה המלך', '31', 'ממשלתי'],
  ['632', 'שלמה המלך 41', 'שלמה המלך', '41', 'ממשלתי'],
  ['633', 'שלמה המלך 51', 'שלמה המלך', '51', 'ממשלתי'],
  ['634', 'רחל אלתר 19', 'רחל אלתר', '19', 'חסכון ג'],
  ['641', 'דיזרעלי 11', 'דיזרעלי', '11', 'עמידר'],
  ['642', 'דיזרעלי 42', 'דיזרעלי', '42', 'עמידר'],
  ['644', 'עמנואל 2', 'עמנואל', '2', 'חסכון ג'],
  ['645', 'שושנים 7', 'שושנים', '7', 'חסכון ג'],
  ['650', 'מעבר אברהם', 'מעבר אברהם', '', 'מרכז'],
  ['651', 'מעבר אברהם', 'מעבר אברהם', '', 'מרכז'],
  ['652', 'אברבנאל 2', 'אברבנאל', '2', ''],
  ['653', 'השקמה 2', 'השקמה', '2', 'גני אביב'],
  ['654', 'מנשה קפרא 6', 'מנשה קפרא', '6', 'גני אביב'],
  ['655', 'נחל שורק 9', 'נחל שורק', '9', 'גני אביב'],
  ['657', 'דה שליט 3', 'דה שליט', '3', 'שביל ישראל'],
  ['658', 'בן שטח 1', 'בן שטח', '1', 'שביל ישראל'],
  ['660', 'יפתח 6', 'יפתח', '6', 'גנים'],
  ['661', 'ויצמן 11', 'ויצמן', '11', 'גנים'],
];

// English fallback address map
const EN_FALLBACK = {
  'גן שרת': 'Gan Sharet',
  'אלי כהן': 'Eli Cohen',
  'החלוץ': 'HaHalutz',
  'שלמה המלך': 'Shlomo HaMelech',
  'הברושים': 'HaBroshim',
  'גושן': 'Goshen',
  'גלעד': 'Gilad',
  'הורדים': 'HaVradim',
  'יצחק בן צבי': 'Yitzhak Ben Zvi',
  'האלון': 'HaAlon',
  'הרימון': 'HaRimon',
  'מעלות המושבה': 'Maalot HaMoshava',
  'אחד העם': 'Ahad HaAm',
  'הגדוד העברי': 'HaGdud HaIvri',
  'דניאל': 'Daniel',
  'אצ"ל': 'Etzel',
  'יוסף שפרינצק': 'Yosef Sprinzak',
  'יצחק מודעי': 'Yitzhak Modai',
  'שמשון': 'Shimshon',
  'מאנגר': 'Manger',
  'יוסף שילוח': 'Yosef Shiloah',
  'רחל אלתר': 'Rachel Alter',
  'דיזרעלי': 'Disraeli',
  'עמנואל': 'Emanuel',
  'שושנים': 'Shoshanim',
  'מעבר אברהם': 'Maavar Avraham',
  'אברבנאל': 'Abarbanel',
  'השקמה': 'HaShikma',
  'מנשה קפרא': 'Menashe Kapra',
  'נחל שורק': 'Nahal Sorek',
  'דה שליט': 'De Shalit',
  'בן שטח': 'Ben Shetach',
  'יפתח': 'Yiftach',
  'ויצמן': 'Weizmann',
};

// Lod bounding box (from Google Geocoding API)
const LOD_BOUNDS = { latMin: 31.932, latMax: 31.975, lonMin: 34.867, lonMax: 34.922 };

function inLodBounds(lat, lon) {
  return lat >= LOD_BOUNDS.latMin && lat <= LOD_BOUNDS.latMax &&
         lon >= LOD_BOUNDS.lonMin && lon <= LOD_BOUNDS.lonMax;
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const type = data.results[0].geometry.location_type;
    if (type === 'APPROXIMATE') return null;
    if (!inLodBounds(loc.lat, loc.lng)) {
      console.log(`  [bounds] Rejected ${loc.lat},${loc.lng} (${data.results[0].formatted_address})`);
      return null;
    }
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address, type };
  }
  return null;
}

async function geocodeWithFallback(street, houseNum) {
  const addrLocal = houseNum ? `${street} ${houseNum}` : street;
  const fullAddr = `${addrLocal}, ${CITY}, ישראל`;

  let geo = await geocode(fullAddr);
  if (geo) return { geo, addrLocal };

  // Try English fallback
  const enStreet = EN_FALLBACK[street];
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

  console.log('=== Lod Shelters ===');
  for (const [id, rawAddr, street, houseNum, neighborhood] of SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `lod_${id}`,
        lat: geo.lat, lon: geo.lon,
        name: `מקלט ${id}`,
        address: `${addrLocal}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
        neighborhood,
      });
      success++;
      console.log(`OK ${id}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${id}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nTotal: ${success} geocoded, ${fail} failed out of ${SHELTERS.length}`);

  const outPath = path.join(__dirname, '..', 'data', 'lod-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
