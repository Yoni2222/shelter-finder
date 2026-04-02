'use strict';
/**
 * Build Ra'anana shelters data from municipality website.
 * Source: https://www.raanana.muni.il/cityhall/safety-and-emergency/public-shelters/
 *
 * Run: node scripts/build-raanana-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = 'רעננה';
const CITY_EN = "Ra'anana";

// ── Public shelters (45) ──
const PUBLIC_SHELTERS = [
  [1, 'אסירי ציון', '13'],
  [2, 'הסיגלית', '7'],
  [3, 'התקווה', '3'],
  [4, 'הנורית', '2'],
  [5, 'מורשה', '5'],
  [6, 'הרותם', '4'],
  [7, 'מולדת', '8'],
  [8, 'המרגנית', '3'],
  [9, 'פטריה', '18'],
  [10, 'יציאת אירופה', '35'],
  [11, 'פטריה', '33'],
  [12, 'יציאת אירופה', '4'],
  [13, 'התחיה', '39'],
  [14, 'פרץ', '12'],
  [15, 'פרץ', '50'],
  [16, 'ויצמן', '100'],
  [17, 'דב הוז', '22'],
  [18, 'דב הוז', '39'],
  [19, "נג'ארה", '2'],
  [20, "האר\"י", '1'],
  [21, 'קרן היסוד', '75'],
  [22, 'שמואל הנגיד', '31'],
  [23, 'אלקלעי', '12'],
  [24, 'אזולאי', '3'],
  [25, 'דגניה', '65'],
  [26, 'הפלמ"ח', '15'],
  [27, 'בורוכוב', '92'],
  [28, 'כנרת', '3'],
  [29, 'העבודה', '13'],
  [30, 'בר אילן', '67'],
  [31, 'נחמיה', '15'],
  [32, 'רמח"ל', '9'],
  [33, 'דב גרונר', '2'],
  [34, 'מבצע קדש', '9'],
  [35, 'מגדל', '21'],
  [36, 'מגדל', '5'],
  [38, 'הרצל', '1'],
  [40, 'ברנדס', '44'],
  [41, 'ברנדס', '58'],
  [42, 'בר אילן', '27'],
  [45, 'מכבי', '63'],
  [46, 'ההסתדרות', '57'],
  [47, 'רבוצקי', '58'],
  [49, 'אשר', '39'],
  [52, 'אליעזר יפה', '12'],
];

// ── School shelters (22) ──
const SCHOOL_SHELTERS = [
  ['s1', 'הפרחים', '1', 'תיכון אביב'],
  ['s2', 'הפלמ"ח', '2', 'תיכון מטרו ווסט'],
  ['s3', 'אוסטרובסקי', '26', 'תיכון אוסטרובסקי'],
  ['s4', 'דובנוב', '13', 'חטיבת השרון'],
  ['s5', 'יאיר שטרן', '5', 'בית ספר שקד'],
  ['s6', 'ששת הימים', '25', 'בית ספר אריאל'],
  ['s7', 'אליעזר יפה', '14', 'בית ספר ברטוב'],
  ['s8', 'שברץ', '24', 'בית ספר דקל'],
  ['s9', 'הגדוד העברי', '9', 'בית ספר הדר'],
  ['s10', 'קרן היסוד', '20', 'בית הספר היובל'],
  ['s11', 'קלוזנר', '27', 'בית ספר זיו'],
  ['s12', 'רש"י', '19', 'חטיבת יונתן'],
  ['s13', 'חפץ חיים', '3', 'בית ספר יבנה'],
  ['s14', 'התקווה', '12', 'בית ספר יחדיו'],
  ['s15', 'אחוזה', '105', 'בית ספר מגד'],
  ['s16', 'החי"ל', '46', 'חטיבת אלון'],
  ['s17', 'משה דיין', '5', 'חטיבת רימון'],
  ['s18', 'הפרחים', '21', 'בית ספר תל"י'],
  ['s19', 'התקווה', '2', 'מרכז קהילתי קשת'],
  ['s20', 'ביל"ו', '15', 'בית ספר ביל"ו'],
  ['s21', 'הפעמונים', '18', 'בית ספר פעמונים'],
  ['s22', 'חזון איש', '3', 'בני עקיבא צפון'],
];

// English fallback
const EN_FALLBACK = {
  'אסירי ציון': 'Asirei Tzion',
  'הסיגלית': 'HaSigalit',
  'התקווה': 'HaTikva',
  'הנורית': 'HaNurit',
  'מורשה': 'Morasha',
  'הרותם': 'HaRotem',
  'מולדת': 'Moledet',
  'המרגנית': 'HaMarganit',
  'פטריה': 'Pitriya',
  'יציאת אירופה': 'Yetziat Eropa',
  'התחיה': 'HaThiya',
  'פרץ': 'Peretz',
  'ויצמן': 'Weizmann',
  'דב הוז': 'Dov Hoz',
  "נג'ארה": 'Najara',
  "האר\"י": 'HaAri',
  'קרן היסוד': 'Keren HaYesod',
  'שמואל הנגיד': 'Shmuel HaNagid',
  'אלקלעי': 'Alkalai',
  'אזולאי': 'Azulai',
  'דגניה': 'Degania',
  'הפלמ"ח': 'HaPalmach',
  'בורוכוב': 'Borochov',
  'כנרת': 'Kinneret',
  'העבודה': 'HaAvoda',
  'בר אילן': 'Bar Ilan',
  'נחמיה': 'Nechemya',
  'רמח"ל': 'Ramchal',
  'דב גרונר': 'Dov Gruner',
  'מבצע קדש': 'Mivtza Kadesh',
  'מגדל': 'Migdal',
  'הרצל': 'Herzl',
  'ברנדס': 'Brandeis',
  'מכבי': 'Maccabi',
  'ההסתדרות': 'HaHistadrut',
  'רבוצקי': 'Rabotski',
  'אשר': 'Asher',
  'אליעזר יפה': 'Eliezer Yafe',
  'הפרחים': 'HaPrachim',
  'אוסטרובסקי': 'Ostrovsky',
  'דובנוב': 'Dubnov',
  'יאיר שטרן': 'Yair Stern',
  'ששת הימים': 'Sheshet HaYamim',
  'שברץ': 'Shvartz',
  'הגדוד העברי': 'HaGdud HaIvri',
  'קלוזנר': 'Klausner',
  'רש"י': 'Rashi',
  'חפץ חיים': 'Chafetz Chaim',
  'אחוזה': 'Achuza',
  'החי"ל': 'HaChail',
  'משה דיין': 'Moshe Dayan',
  'ביל"ו': 'Bilu',
  'הפעמונים': 'HaPaamonim',
  'חזון איש': 'Chazon Ish',
};

// Ra'anana bounding box
const BOUNDS = { latMin: 32.16, latMax: 32.21, lonMin: 34.85, lonMax: 34.89 };

function inBounds(lat, lon) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax &&
         lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax;
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const type = data.results[0].geometry.location_type;
    if (type === 'APPROXIMATE') return null;
    if (!inBounds(loc.lat, loc.lng)) {
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

  // Process public shelters
  console.log('=== Public Shelters ===');
  for (const [num, street, houseNum] of PUBLIC_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `raanana_pub_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: `מקלט ${num}`,
        address: `${street} ${houseNum}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
        neighborhood: '',
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
  for (const [sId, street, houseNum, schoolName] of SCHOOL_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `raanana_${sId}`,
        lat: geo.lat, lon: geo.lon,
        name: schoolName,
        address: `${street} ${houseNum}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט בית ספר',
        source: 'gov', category: 'school', addressEn: geo.formatted,
        neighborhood: '',
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

  const outPath = path.join(__dirname, '..', 'data', 'raanana-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
