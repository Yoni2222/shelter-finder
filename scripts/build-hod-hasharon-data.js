'use strict';
/**
 * Build Hod HaSharon shelters data from municipality website.
 *
 * Run: node scripts/build-hod-hasharon-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = 'הוד השרון';
const CITY_EN = 'Hod HaSharon';

// ── Public shelters (34) ──
const PUBLIC_SHELTERS = [
  [1, 'סוקולוב', '18', 'מגדיאל'],
  // 2 skipped – גן ציבורי מגדיאל, no street address
  [3, 'נצח ישראל', '41', 'מגדיאל'],
  [4, 'אילת', '', 'גיל עמל'],
  [5, 'ששת הימים', '', 'גיל עמל'],
  [6, 'רמב"ם', '', 'שכונת מזרח'],
  [7, 'הגולן', '', 'גיל עמל'],
  [8, 'השחל', '', 'גיל עמל'],
  [9, 'בבלי', '3', 'גיורא'],
  [10, 'ירושלמי', '', 'גיורא'],
  [11, 'מנוחה ונחלה', '1', 'גיורא'],
  [12, 'החייל', '', 'גיורא'],
  [13, 'יורדי הים', '', 'גני צבי'],
  [14, 'יורדי הים', '', 'גני צבי'],
  [15, 'שמעון הצדיק', '22', 'נווה נאמן'],
  [16, 'הרב שלום נגר', '16', 'נווה נאמן'],
  [17, 'התמר', '', 'נווה נאמן'],
  [18, 'סמטת יהונתן', '5', 'נווה נאמן'],
  [19, 'המכבים', '10', 'נווה נאמן'],
  [20, 'המכבים', '44', 'נווה נאמן'],
  [21, 'שמעון הצדיק', '47', 'נווה נאמן'],
  [22, 'הורד', '13', 'שיכון עממי'],
  [23, 'הצבי', '23', 'שיכון עממי'],
  [24, 'גורדון', '', 'שיכון עממי'],
  [25, 'התכלת', '', 'הדר'],
  [26, 'ארלוזורוב', '', 'שכונת הפועלים'],
  [27, 'הפרדס שושנים', '', 'רמת הדר'],
  [28, 'הגלעד', '', 'רמת הדר'],
  [29, 'סיני', '3', 'נווה הדר'],
  [30, 'השומר', '', 'נווה הדר'],
  [31, 'השומר', '', 'נווה הדר'],
  [32, 'הפרסה', '7', 'רמתיים'],
  [33, 'השקמים', '', 'רמתיים'],
  [34, 'הרשות', '', ''],
];

// ── Migoniyot – protected spaces (15) ──
const MIGONIYOT = [
  ['m1', 'הבנים', '53', 'בי"ס הדמוקרטי', ''],
  ['m2', 'המחתרות', '', 'מגרש כדורגל גני צבי', 'גני צבי'],
  ['m3', 'הפלמ"ח', '', 'מגרש כדורגל נווה הדר', 'נווה הדר'],
  ['m4', 'ששת הימים', '43', 'גינת מבוא קדם', ''],
  ['m5', 'קיבוץ גלויות', '8', 'בי"ס רמות', ''],
  ['m6', 'הציונות', '', 'פארק ארבע עונות', ''],
  ['m7', 'גולן', '', 'גינת גולן', ''],
  ['m8', 'שמעון הצדיק', '33', '', 'נווה נאמן'],
  ['m9', 'כנרת', '2', '', ''],
  ['m10', 'שביל התיכון', '', 'ליד בית המתנדב', ''],
  // m11 skipped – ספורטק, landmark only
  // m12 skipped – פארק אקולוגי, landmark only
  ['m13', 'חנקין', '', 'ליד פארק מגדיאל', 'מגדיאל'],
  ['m14', 'ז\'בוטינסקי', '', 'בית המתנדב', ''],
  ['m15', 'סמטת הדבש', '13', '', 'גני צבי'],
];

// ── School shelters (25) ──
const SCHOOL_SHELTERS = [
  ['s1', 'הבנים', '53', 'בית הספר הדמוקרטי'],
  ['s2', 'נחשון', '6', 'בית הספר הירוק'],
  ['s3', 'המגן', '32', 'בית הספר המגן'],
  ['s4', 'משאבים', '46', 'בית הספר יגאל אלון'],
  ['s5', 'פשוש', '4', 'בית הספר יצחק רבין'],
  ['s6', 'השחר', '34', 'בית הספר לפיד'],
  ['s7', 'הנריאטה סאלד', '2', 'בית הספר ממלכתי א'],
  ['s8', 'גולדה מאיר', '9', 'בית הספר מנחם בגין'],
  ['s9', 'אלכסנדר הגדול', '12', 'בית הספר לאמנויות'],
  ['s10', 'נחשון', '8', 'בית ספר נחשון'],
  ['s11', 'הנריאטה סולד', '26', 'בית ספר צורים'],
  ['s12', 'קיבוץ גלויות', '8', 'בית ספר רמות'],
  ['s13', 'הדרים', '12', 'בית ספר רעות'],
  ['s14', 'אסירי ציון', '1', 'בית ספר שילה'],
  ['s15', 'גולדה מאיר', '13', 'בית הספר יעל רום'],
  ['s16', 'גולומב', '', 'בית הספר תמר'],
  ['s17', 'השחר', '36', 'חטיבת ביניים השחר'],
  ['s18', 'פדויים', '16', 'חטיבת ביניים הראשונים'],
  ['s19', 'השקמים', '29', 'חטיבת ביניים השקמים'],
  ['s20', 'יאנוש קורצ\'אק', '1', 'חטיבת ביניים עתידים'],
  ['s21', 'עלית הנוער', '1', 'תיכון מוסינזון'],
  ['s22', 'השקמים', '31', 'תיכון השקמים'],
  ['s23', 'ז\'בוטינסקי', '', 'תיכון הדרים'],
  ['s24', 'החרש', '9', 'תיכון עמל'],
  ['s25', 'גולומב', '10', 'החווה החקלאית'],
];

// ── Kindergarten shelters (6) ──
const KINDERGARTEN_SHELTERS = [
  ['k1', 'אנצילביץ', '2', 'גן תפוח ואגס'],
  ['k2', 'המנחם', '2', 'גן הדר'],
  ['k3', 'יורדי הים', '32', 'גן נחניאלי וזמיר'],
  ['k4', 'מבצע קדש', '2', 'גן אגוז'],
  ['k5', 'הנגב', '12', 'גן אזדרכת ולילך'],
  ['k6', 'שמעון הצדיק', '14', 'גן מורן ויסמין'],
];

// English fallback
const EN_FALLBACK = {
  'סוקולוב': 'Sokolov',
  'נצח ישראל': 'Netzach Israel',
  'אילת': 'Eilat',
  'ששת הימים': 'Sheshet HaYamim',
  'רמב"ם': 'Rambam',
  'הגולן': 'HaGolan',
  'השחל': 'HaShahal',
  'בבלי': 'Bavli',
  'ירושלמי': 'Yerushalmi',
  'מנוחה ונחלה': 'Menucha VeNachala',
  'החייל': 'HaChayal',
  'יורדי הים': 'Yordei HaYam',
  'שמעון הצדיק': 'Shimon HaTzadik',
  'הרב שלום נגר': 'HaRav Shalom Nagar',
  'התמר': 'HaTamar',
  'סמטת יהונתן': 'Simtat Yehonatan',
  'המכבים': 'HaMaccabim',
  'הורד': 'HaVered',
  'הצבי': 'HaTzvi',
  'גורדון': 'Gordon',
  'התכלת': 'HaTechelet',
  'ארלוזורוב': 'Arlosorov',
  'הפרדס שושנים': 'HaPardes Shoshanim',
  'הגלעד': 'HaGilad',
  'סיני': 'Sinai',
  'השומר': 'HaShomer',
  'הפרסה': 'HaParsa',
  'השקמים': 'HaShkamim',
  'הרשות': 'HaReshut',
  'הבנים': 'HaBanim',
  'המחתרות': 'HaMachtarot',
  'הפלמ"ח': 'HaPalmach',
  'קיבוץ גלויות': 'Kibbutz Galuyot',
  'הציונות': 'HaTzionut',
  'גולן': 'Golan',
  'כנרת': 'Kinneret',
  'שביל התיכון': 'Shvil HaTichon',
  'חנקין': 'Hankin',
  'ז\'בוטינסקי': 'Jabotinsky',
  'סמטת הדבש': 'Simtat HaDvash',
  'נחשון': 'Nachshon',
  'המגן': 'HaMagen',
  'משאבים': 'Meshavim',
  'פשוש': 'Pashosh',
  'השחר': 'HaShachar',
  'הנריאטה סאלד': 'Henrietta Szold',
  'הנריאטה סולד': 'Henrietta Szold',
  'גולדה מאיר': 'Golda Meir',
  'אלכסנדר הגדול': 'Alexander HaGadol',
  'הדרים': 'HaDarim',
  'אסירי ציון': 'Asirei Tzion',
  'גולומב': 'Golomb',
  'פדויים': 'Pduyim',
  'יאנוש קורצ\'אק': 'Janusz Korczak',
  'עלית הנוער': 'Aliyat HaNoar',
  'החרש': 'HaCharash',
  'אנצילביץ': 'Antzilbitz',
  'המנחם': 'HaMenachem',
  'מבצע קדש': 'Mivtza Kadesh',
  'הנגב': 'HaNegev',
};

// Hod HaSharon bounding box
const BOUNDS = { latMin: 32.13, latMax: 32.18, lonMin: 34.87, lonMax: 34.92 };

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
  for (const [num, street, houseNum, neighborhood] of PUBLIC_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `hod_pub_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: `מקלט ${num}`,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
        neighborhood: neighborhood || '',
      });
      success++;
      console.log(`OK ${num}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${num}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process migoniyot (protected spaces)
  console.log('\n=== Migoniyot ===');
  for (const [mId, street, houseNum, mName, neighborhood] of MIGONIYOT) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    const num = mId.replace('m', '');
    if (geo) {
      shelters.push({
        id: `hod_mig_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: mName || `מרחב מוגן ${num}`,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY, capacity: '', type: 'מרחב מוגן',
        source: 'gov', category: 'public', addressEn: geo.formatted,
        neighborhood: neighborhood || '',
      });
      success++;
      console.log(`OK ${mId}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${mId}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process school shelters
  console.log('\n=== School Shelters ===');
  for (const [sId, street, houseNum, schoolName] of SCHOOL_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    const num = sId.replace('s', '');
    if (geo) {
      shelters.push({
        id: `hod_school_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: schoolName,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
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

  // Process kindergarten shelters
  console.log('\n=== Kindergarten Shelters ===');
  for (const [kId, street, houseNum, kinderName] of KINDERGARTEN_SHELTERS) {
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    const num = kId.replace('k', '');
    if (geo) {
      shelters.push({
        id: `hod_kinder_${num}`,
        lat: geo.lat, lon: geo.lon,
        name: kinderName,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט גן ילדים',
        source: 'gov', category: 'school', addressEn: geo.formatted,
        neighborhood: '',
      });
      success++;
      console.log(`OK ${kinderName}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${kinderName}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  const total = PUBLIC_SHELTERS.length + MIGONIYOT.length + SCHOOL_SHELTERS.length + KINDERGARTEN_SHELTERS.length;
  console.log(`\nTotal: ${success} geocoded, ${fail} failed out of ${total}`);

  const outPath = path.join(__dirname, '..', 'data', 'hod-hasharon-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
