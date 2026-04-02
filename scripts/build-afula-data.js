'use strict';
/**
 * Build Afula shelters data from municipality PDF.
 * Source: Afula municipality public shelter list
 *
 * Run: node scripts/build-afula-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = 'עפולה';

// ── Public shelters ──
// Format: [shelterNumber, street, houseNumber]
const PUBLIC_SHELTERS = [
  // גבעת-המורה area
  [100,'עגור','5'],
  [101,'הנרייטה סולד',''],
  [102,'הנרייטה סולד','33'],
  [103,'הנרייטה סולד','29'],
  [105,'פשוש','15'],
  [106,'הנרייטה סולד','22'],
  [107,'הנרייטה סולד','26'],
  [108,'הנרייטה סולד','18'],
  [109,'בן יהודה','29'],
  [110,'ראסל','19'],
  [111,'הנרייטה סולד','6'],
  [112,'עליית הנוער','6'],
  [113,'אבן גבירול','40'],
  [114,'אבן גבירול','32'],
  [115,'אבן גבירול','29'],
  [116,'שלום','2'],
  [117,'אבן גבירול','23'],
  [118,'אלבז נתן','1'],
  [119,'הרצוג','9'],
  [120,'מאפו אברהם','2'],
  [121,'קוממיות','14'],
  [122,'מצפה','5'],
  [123,'מצפה','37'],
  [124,'קוממיות','29'],

  // עפולה עילית area
  [200,'בורוכוב','17'],
  [201,'קקל','25'],
  [202,'קקל','8'],
  [203,'יהודה הלוי','10'],
  [204,'הגודד','15'],
  [205,'סוקולוב','36'],
  [206,'בורוכוב','45'],
  [207,'אחד העם','4'],
  [208,'כצנלסון','2'],
  [212,'פנקס','39'],
  [213,'פנקס','34'],
  [214,'רשי','31'],
  [215,'הרב חיים יוסף','3'],
  [216,'ההגנה','34'],
  [217,'הפלמח','11'],
  [218,'פרג','4'],
  [221,'וינגייט','17'],
  [224,'דוד מרקוס','10'],

  // עפולה הצעירה area
  [229,'אלון','5'],
  [230,'שושן','20'],
  [231,'הצלף','1'],
  [232,'ערבה','1'],
  [233,'הארז','33'],
  [234,'הארז','39'],
  [235,'הארז','25'],
  [236,'הארז','9'],
  [237,'ערער','19'],
  [238,'דקל','12'],
  [239,'צאלון','15'],
  [240,'מורן','18'],
  [241,'אטד','21'],
  [242,'גומא','13'],
  [243,'ההגנה','54'],
  [244,'תאנה','8'],
  [245,'שעורה','4'],
  [246,'יקינטון','12'],

  // עפולה center
  [300,'תבור',''],
  [301,'עומר','4'],
  [303,'החריש','12'],
  [304,'הגן','1'],
  [305,'הגן','22'],
  [307,'זלמן הוז',''],
  [308,'האתרוג','5'],
  [309,'ארלוזורוב','9'],
  [311,'הכנסת','26'],
  [312,'חריש','12'],
  [313,'הנוטר','9'],
  [314,'הקישון','15'],
];

// ── School shelters ──
// Format: [name, street, houseNumber]
const SCHOOL_SHELTERS = [
  ['בית ספר אלומות','יצחק שדה','6'],
  ['בית ספר נופים','האלה',''],
  ['בית ספר נועם מוריה','הנרייטה סולד','39'],
  ['בית ספר בן-צבי','האירוסים','4'],
  ['בית ספר גוונים','וולפסון','24'],
  ['בית ספר בית זאב','הקונגרס הציוני','34'],
  ['בית ספר יזרעאל','העבודה','13'],
  ['בית ספר אוהל מאיר','הבנים','23'],
  ['בית ספר מעלות','פנקס','12'],
  ['בית ספר אורן','הצפצפות','1'],
  ['בית ספר אלון','האגס','4'],
  ['בית ספר יהודה','הרב פרץ ציוני','33'],
  ['בית ספר אורט','המגשימים','3'],
  ['בית ספר כרמים בעמק','טשרניחובסקי','3'],
  ['בית ספר אופק עמל','זבוטינסקי','8'],
  ['בית ספר אולפנא צביה','וולפסון','21'],
  ['בית ספר תדהר','תדהר','12'],
  ['בית ספר מרום','צוקית','3'],
  ['בית ספר דרך אמת','עגור','3'],
];

// ── Public place shelters ──
// Format: [name, street, houseNumber]
const PUBLIC_PLACE_SHELTERS = [
  ['בית אשכול','קפלן','1'],
  ['בית פוזנק','עליית הנוער','12'],
  ['ביטוח לאומי','ירושלים','4'],
  ['בית עטרת','יהושע חנקין','28'],
  ['מתחם רמי לוי','יהושע חנקין','16'],
  ['קניון העמקים','יהושע חנקין','14'],
  ['מתחם BIG','השוק','13'],
  ['מתחם ONE','קהילת ציון','26'],
  ['מרכז פסגה','יצפור','6'],
  ['מתנס ויצו','עומר','5'],
  ['בית חסון','קהילת ציון','1'],
  ['אצולת העמק','בגין','67'],
  ['מעש','רשי','1'],
  ['בית אורי','הצוקית','4'],
  ['היכל התרבות','חטיבה','9'],
];

// English fallback address map for Hebrew addresses that fail geocoding
const EN_FALLBACK = {
  'עגור': 'Agur',
  'הנרייטה סולד': 'Henrietta Szold',
  'פשוש': 'Pshosh',
  'בן יהודה': 'Ben Yehuda',
  'ראסל': 'Rasel',
  'עליית הנוער': 'Aliyat HaNoar',
  'אבן גבירול': 'Ibn Gabirol',
  'שלום': 'Shalom',
  'אלבז נתן': 'Albaz Natan',
  'הרצוג': 'Herzog',
  'מאפו אברהם': 'Mapu Avraham',
  'קוממיות': 'Komemiyut',
  'מצפה': 'Mitzpe',
  'בורוכוב': 'Borochov',
  'קקל': 'KKL',
  'יהודה הלוי': 'Yehuda HaLevi',
  'הגודד': 'HaGdud',
  'סוקולוב': 'Sokolov',
  'אחד העם': 'Ahad HaAm',
  'כצנלסון': 'Katznelson',
  'פנקס': 'Pinkas',
  'רשי': 'Rashi',
  'הרב חיים יוסף': 'HaRav Chaim Yosef',
  'ההגנה': 'HaHagana',
  'הפלמח': 'HaPalmach',
  'פרג': 'Pereg',
  'וינגייט': 'Wingate',
  'דוד מרקוס': 'David Marcus',
  'אלון': 'Alon',
  'שושן': 'Shoshan',
  'הצלף': 'HaTzalaf',
  'ערבה': 'Arava',
  'הארז': 'HaErez',
  'ערער': 'Arar',
  'דקל': 'Dekel',
  'צאלון': 'Tzealon',
  'מורן': 'Moran',
  'אטד': 'Atad',
  'גומא': 'Gome',
  'תאנה': 'Teena',
  'שעורה': 'Seora',
  'יקינטון': 'Yakinton',
  'תבור': 'Tavor',
  'עומר': 'Omer',
  'החריש': 'HaHarish',
  'חריש': 'Harish',
  'הגן': 'HaGan',
  'זלמן הוז': 'Zalman Hoz',
  'האתרוג': 'HaEtrog',
  'ארלוזורוב': 'Arlozorov',
  'הכנסת': 'HaKnesset',
  'הנוטר': 'HaNoter',
  'הקישון': 'HaKishon',
  'יצחק שדה': 'Yitzhak Sade',
  'האלה': 'HaEla',
  'האירוסים': 'HaIrusim',
  'וולפסון': 'Wolfson',
  'הקונגרס הציוני': 'HaKongres HaTzioni',
  'העבודה': 'HaAvoda',
  'הבנים': 'HaBanim',
  'הצפצפות': 'HaTzaftzafot',
  'האגס': 'HaAgas',
  'הרב פרץ ציוני': 'HaRav Peretz Tzioni',
  'המגשימים': 'HaMagshimim',
  'טשרניחובסקי': 'Tchernichovsky',
  'זבוטינסקי': 'Jabotinsky',
  'תדהר': 'Tidhar',
  'צוקית': 'Tzukit',
  'קפלן': 'Kaplan',
  'ירושלים': 'Yerushalayim',
  'יהושע חנקין': 'Yehoshua Hankin',
  'השוק': 'HaShuk',
  'קהילת ציון': 'Kehilat Tzion',
  'יצפור': 'Yitzpor',
  'בגין': 'Begin',
  'הצוקית': 'HaTzukit',
  'חטיבה': 'Hativa',
};

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
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

async function geocodeWithFallback(street, houseNum) {
  const addrLocal = houseNum ? `${street} ${houseNum}` : street;
  const fullAddr = `${addrLocal}, ${CITY}, ישראל`;

  let geo = await geocode(fullAddr);
  if (geo) return { geo, addrLocal };

  // Try English fallback
  const enStreet = EN_FALLBACK[street];
  if (enStreet) {
    const enAddr = houseNum ? `${enStreet} ${houseNum}, Afula, Israel` : `${enStreet}, Afula, Israel`;
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
        id: `afula_${num}`,
        lat: geo.lat,
        lon: geo.lon,
        name: `מקלט ${num}`,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY,
        capacity: '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log(`✓ ${num}: ${addrLocal} → ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`✗ ${num}: ${addrLocal} → FAILED`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process school shelters
  console.log('\n=== School Shelters ===');
  for (let i = 0; i < SCHOOL_SHELTERS.length; i++) {
    const [name, street, houseNum] = SCHOOL_SHELTERS[i];
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `afula_school_${i + 1}`,
        lat: geo.lat,
        lon: geo.lon,
        name,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY,
        capacity: '',
        type: 'school',
        source: 'gov',
        category: 'school',
        addressEn: geo.formatted,
      });
      success++;
      console.log(`✓ ${name}: ${addrLocal} → ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`✗ ${name}: ${addrLocal} → FAILED`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Process public place shelters
  console.log('\n=== Public Place Shelters ===');
  for (let i = 0; i < PUBLIC_PLACE_SHELTERS.length; i++) {
    const [name, street, houseNum] = PUBLIC_PLACE_SHELTERS[i];
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `afula_public_${i + 1}`,
        lat: geo.lat,
        lon: geo.lon,
        name,
        address: houseNum ? `${street} ${houseNum}, ${CITY}` : `${street}, ${CITY}`,
        city: CITY,
        capacity: '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log(`✓ ${name}: ${addrLocal} → ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`✗ ${name}: ${addrLocal} → FAILED`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  const total = PUBLIC_SHELTERS.length + SCHOOL_SHELTERS.length + PUBLIC_PLACE_SHELTERS.length;
  console.log(`\nTotal: ${success} geocoded, ${fail} failed out of ${total}`);

  const outPath = path.join(__dirname, '..', 'data', 'afula-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
