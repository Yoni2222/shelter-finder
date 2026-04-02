'use strict';
/**
 * Build Ramle shelters data from municipality website.
 * Source: https://ramle.org.il/רשימת-המקלטים-הציבוריים/
 *
 * Run: node scripts/build-ramle-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = 'רמלה';
const CITY_EN = 'Ramle';

// ── Public shelters by neighborhood ──
const PUBLIC_SHELTERS = [
  // Bilu (ביל"ו)
  [23, 'צידון', '4', 'ביל"ו'],
  [24, 'יבנה', '12', 'ביל"ו'],
  [116, 'מסדה', '5', 'ביל"ו'],
  [117, 'מרים הנביאה', '15', 'ביל"ו'],
  [409, 'מסדה', '1', 'ביל"ו'],
  [479, 'מרים הנביאה', '6', 'ביל"ו'],

  // Mishkanot-Center (משכנות-מרכז)
  [118, 'הרב מימון', '4', 'משכנות-מרכז'],
  [380, 'לוחמי גוש עציון', '29', 'משכנות-מרכז'],
  [381, 'שלום עליכם', '9', 'משכנות-מרכז'],
  [385, 'סמולנסקי', '3', 'משכנות-מרכז'],
  [480, 'הרב קוק', '11', 'משכנות-מרכז'],

  // Old City (העיר העתיקה)
  [453, 'שפיק עדס', '1', 'העיר העתיקה'],
  [174, 'יהושע בן נון', '11', 'העיר העתיקה'],
  [323, 'ביאליק', '34', 'העיר העתיקה'],
  [382, 'שפיק עדס', '4', 'העיר העתיקה'],
  [386, 'קלאוזנר', '7', 'העיר העתיקה'],
  [475, 'עובדיה סומך', '14', 'העיר העתיקה'],

  // Amishav (עמישב)
  [390, 'שלום איפרגן', '10', 'עמישב'],
  [391, 'יוסף בן שלמה', '20', 'עמישב'],
  [470, 'אמיל זולא', '1', 'עמישב'],

  // Eshkol (אשכול)
  [175, 'ברזילי', '4', 'אשכול'],
  [176, 'חיים שפירא', '11', 'אשכול'],
  [177, 'אבוחצירא', '14', 'אשכול'],
  [178, 'קרן היסוד', '1', 'אשכול'],
  [187, 'אשכול', '19', 'אשכול'],
  [223, 'אשכול', '8', 'אשכול'],
  [234, 'אשכול', '32', 'אשכול'],
  [274, 'אשכול', '9', 'אשכול'],
  [275, 'סמטת תוחלת', '9', 'אשכול'],
  [276, 'סמטת תוחלת', '3', 'אשכול'],
  [450, 'גיבורי ישראל', '4', 'אשכול'],
  [173, 'גטו ורשה', '3', 'אשכול'],
  [455, 'גיבורי ישראל', '2', 'אשכול'],
  [184, 'אבוחצירא', '7', 'אשכול'],

  // Neve Meir (נווה-מאיר)
  [121, 'הלילך', '18', 'נווה-מאיר'],
  [123, 'מור', '10', 'נווה-מאיר'],

  // Neve David (נווה-דוד)
  [131, 'דב הוז', '1', 'נווה-דוד'],
  [322, 'גורדון', '19', 'נווה-דוד'],
  [387, 'הדר', '14', 'נווה-דוד'],
  [454, 'ישראל פרנקל', '15', 'נווה-דוד'],
  [213, 'אנגל', '9', 'נווה-דוד'],

  // Giora (גיורא)
  [145, 'הצנחנים', '4', 'גיורא'],
  [180, 'חטיבת גולני', '4', 'גיורא'],
  [181, 'חטיבת גולני', '6', 'גיורא'],
  [393, 'עמיחי', '17', 'גיורא'],
  [394, 'צנחנים', '10', 'גיורא'],
  [186, 'עמיחי', '3', 'גיורא'],

  // Ramat Dan (רמת-דן)
  [182, 'התשעה', '202', 'רמת-דן'],
  [183, 'גולדה מאיר', '2', 'רמת-דן'],

  // Shprintzak (שפרינצק)
  [122, 'אחד במאי', '7', 'שפרינצק'],
  [214, 'מבצע קדש', '4', 'שפרינצק'],
  [452, 'סטרומה', '5', 'שפרינצק'],

  // Weizmann (ויצמן)
  [396, 'אברהם הלל', '10', 'ויצמן'],
  [451, 'בן צבי', '29', 'ויצמן'],
  [119, 'אברהם הלל', '7', 'ויצמן'],
  [197, 'אברהם הלל', '13', 'ויצמן'],
  [392, 'בן צבי', '9', 'ויצמן'],

  // HaShoftim (השופטים)
  [139, 'גדוד העברי', '6', 'השופטים'],
];

// ── School shelters ──
const SCHOOL_SHELTERS = [
  ['s1', 'שמואל תמיר', '3', 'בי"ס אופק'],
  ['s2', 'דוד רזיאל', '32', 'בי"ס בן גוריון'],
  ['s3', 'יוספטל', '23', 'בי"ס מענית'],
  ['s4', 'בורוכוב', '20', 'בי"ס אריאל'],
  ['s5', 'ברזילי', '3', 'בי"ס בר אילן'],
  ['s6', 'אברהם הלל', '10', 'בי"ס בן צבי'],
  ['s7', 'המעפילים', '7', 'בי"ס אלאמל'],
  ['s8', 'וילנה', '6', 'קידום נוער-עצמאות'],
];

// English fallback address map
const EN_FALLBACK = {
  'צידון': 'Tsidon',
  'יבנה': 'Yavne',
  'מסדה': 'Masada',
  'מרים הנביאה': 'Miriam HaNevia',
  'הרב מימון': 'HaRav Maimon',
  'לוחמי גוש עציון': 'Lochamei Gush Etzion',
  'שלום עליכם': 'Shalom Aleichem',
  'סמולנסקי': 'Smolenskin',
  'הרב קוק': 'HaRav Kook',
  'שפיק עדס': 'Shafiq Adas',
  'יהושע בן נון': 'Yehoshua Bin Nun',
  'ביאליק': 'Bialik',
  'קלאוזנר': 'Klausner',
  'עובדיה סומך': 'Ovadia Somech',
  'שלום איפרגן': 'Shalom Ifergan',
  'יוסף בן שלמה': 'Yosef Ben Shlomo',
  'אמיל זולא': 'Emil Zola',
  'ברזילי': 'Barzilai',
  'חיים שפירא': 'Chaim Shapira',
  'אבוחצירא': 'Abuhatzeira',
  'קרן היסוד': 'Keren HaYesod',
  'אשכול': 'Eshkol',
  'סמטת תוחלת': 'Simtat Tochelet',
  'גיבורי ישראל': 'Gibborei Israel',
  'גטו ורשה': 'Ghetto Varsha',
  'הלילך': 'HaLilach',
  'מור': 'Mor',
  'דב הוז': 'Dov Hoz',
  'גורדון': 'Gordon',
  'הדר': 'Hadar',
  'ישראל פרנקל': 'Israel Frankel',
  'אנגל': 'Engel',
  'הצנחנים': 'HaTzanhanim',
  'חטיבת גולני': 'Hativat Golani',
  'עמיחי': 'Amichai',
  'צנחנים': 'Tzanhanim',
  'התשעה': 'HaTisha',
  'גולדה מאיר': 'Golda Meir',
  'אחד במאי': 'Echad BeMay',
  'מבצע קדש': 'Mivtza Kadesh',
  'סטרומה': 'Struma',
  'אברהם הלל': 'Avraham Hillel',
  'בן צבי': 'Ben Zvi',
  'גדוד העברי': 'Gdud HaIvri',
  'שמואל תמיר': 'Shmuel Tamir',
  'דוד רזיאל': 'David Raziel',
  'יוספטל': 'Yoseftal',
  'בורוכוב': 'Borochov',
  'המעפילים': 'HaMaapilim',
  'וילנה': 'Vilna',
};

// Manual coordinate overrides for addresses Google can't resolve in Ramle
const MANUAL_COORDS = {
  'עובדיה סומך 14': { lat: 31.9262, lon: 34.8695, formatted: 'Ovadia Somech St 14, Ramla, Israel' },
  'אשכול 8': { lat: 31.9295, lon: 34.8573, formatted: 'Eshkol St 8, Ramla, Israel' },
  'גורדון 19': { lat: 31.9370, lon: 34.8635, formatted: 'Gordon St 19, Ramla, Israel' },
  'התשעה 202': { lat: 31.9317, lon: 34.8544, formatted: "Ha-Tish'a St 202, Ramla, Israel" },
};

// Ramle bounding box
const RAMLE_BOUNDS = { latMin: 31.910, latMax: 31.940, lonMin: 34.850, lonMax: 34.890 };

function inRamleBounds(lat, lon) {
  return lat >= RAMLE_BOUNDS.latMin && lat <= RAMLE_BOUNDS.latMax &&
         lon >= RAMLE_BOUNDS.lonMin && lon <= RAMLE_BOUNDS.lonMax;
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const type = data.results[0].geometry.location_type;
    if (type === 'APPROXIMATE') return null;
    if (!inRamleBounds(loc.lat, loc.lng)) {
      console.log(`  [bounds] Rejected ${loc.lat},${loc.lng} (${data.results[0].formatted_address})`);
      return null;
    }
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address, type };
  }
  return null;
}

async function geocodeWithFallback(street, houseNum) {
  const addrLocal = houseNum ? `${street} ${houseNum}` : street;

  // Check manual coordinate overrides first
  if (MANUAL_COORDS[addrLocal]) {
    console.log(`  [manual] Using manual coords for ${addrLocal}`);
    return { geo: MANUAL_COORDS[addrLocal], addrLocal };
  }

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

  // Process public shelters
  console.log('=== Public Shelters ===');
  for (const [num, street, houseNum, neighborhood] of PUBLIC_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `ramle_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: `מקלט ${num}`,
        address: `${street} ${houseNum}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
        neighborhood,
      });
      success++;
      console.log(`OK ${num}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${num}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process school shelters
  console.log('\n=== School Shelters ===');
  for (let i = 0; i < SCHOOL_SHELTERS.length; i++) {
    const [sId, street, houseNum, schoolName] = SCHOOL_SHELTERS[i];
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    const idx = i + 1;
    if (geo) {
      shelters.push({
        id: `ramle_school_${idx}`,
        lat: geo.lat, lon: geo.lon,
        name: schoolName,
        address: `${street} ${houseNum}, ${CITY}`,
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

  const total = PUBLIC_SHELTERS.length + SCHOOL_SHELTERS.length;
  console.log(`\nTotal: ${success} geocoded, ${fail} failed out of ${total}`);

  const outPath = path.join(__dirname, '..', 'data', 'ramle-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
