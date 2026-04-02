'use strict';
/**
 * Build Hadera shelters data.
 * Source: Hadera municipality website
 *
 * Run: node scripts/build-hadera-data.js
 */

const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyB6rgqJ418JtjyhYGzamDqpFt_ugYBMD_g';

// Each entry: [neighborhood, typeHeb, nameOrNumber, address]
const SHELTERS = [
  ['בית אליעזר', 'ציבורי', '1', 'ההגנה 34'],
  ['בית אליעזר', 'ציבורי', '2', 'ההגנה 25'],
  ['בית אליעזר', 'ציבורי', '3', 'השושנים 4'],
  ['בית אליעזר', 'ציבורי', '4', 'הר חורשן 2'],
  ['בית אליעזר', 'ציבורי', '5', 'צאלים'],
  ['בית אליעזר', 'ציבורי', '6', 'תמסח 15'],
  ['בית אליעזר', 'ציבורי', '7', 'תמסח 11'],
  ['בית אליעזר', 'ציבורי', '8', 'תמסח 1'],
  ['בית אליעזר', 'ציבורי', '9', 'תמסח 2'],
  ['בית אליעזר', 'ציבורי', '62', 'שפק 1'],
  ['בית אליעזר', 'ציבורי', '64', 'השקמה 29'],
  ['בית אליעזר', 'מקלט בבית ספר צלילה', null, 'השקמה 15'],
  ['בית אליעזר', 'מקלט בבית ספר קפלן', null, 'יגאל 39'],
  ['בית אליעזר', 'מקלט בבית ספר חב"ד בנות', null, 'יגאל 56'],
  ['בית אליעזר', 'מקלט בבית ספר שובו', null, 'העצמאות 25'],
  ['בית אליעזר', 'מקלט בבית ספר תיכון יש"י', null, 'הגושרים 1'],
  ['בית אליעזר', 'מקלט בבית ספר תיכון חדש', null, 'הנגב פינת שלמה המלך'],
  ['בית אליעזר', 'מחסה תת קרקעי קניון מול הפרדסי', null, 'קותיאל אדם 7'],
  ['יוספטל', 'ציבורי', '11', 'הנרייטה סולד 6'],
  ['יוספטל', 'מרכז פנאי', null, 'סמטת הרב שלום אלבז'],
  ['אפריים', 'ציבורי', '12', 'כצנלסון 16'],
  ['אפריים', 'ציבורי', '13', 'האקליפטוס 15'],
  ['נווה עובד', 'ציבורי', '14', 'בורוכוב 7'],
  ['נחליאל-בילו', 'ציבורי', '15', 'תרע"ב 10'],
  ['נחליאל-בילו', 'ציבורי', '16', 'אצ"ל 11'],
  ['נחליאל-בילו', 'ציבורי', '17', 'הגבורים 122'],
  ['נחליאל-בילו', 'מקלט בבי"ס ארלוזורוב', null, null],
  ['מרכז', 'ציבורי', '20', 'תרנ"א 50'],
  ['מרכז', 'ציבורי', '22', 'הבנים 22'],
  ['מרכז', 'ציבורי', '23', 'ז\'בוטינסקי 40'],
  ['מרכז', 'מחסה תת קרקעי קניון לב חדרה', null, 'רוטשילד פינת הגבורים'],
  ['מרכז', 'מקלט בבי"ס הגורן', null, 'זלמן שזר 8'],
  ['מרכז', 'מקלט בבי"ס תיכון חדרה', null, 'לבזובסקי 6'],
  ['פאר-עובדים', 'ציבורי', '24', 'בן צבי 2'],
  ['ברנדיס-ניסן', 'מקלט בבי"ס צפרירים', null, 'האלון 28'],
  ['ברנדיס-ניסן', 'ציבורי', '25', 'ההדס 25'],
  ['ברנדיס-ניסן', 'מקלט בבי"ס הדמוקרטי', null, 'ברנדיס 14'],
  ['שמשון', 'ציבורי', '27', 'הדרור 16'],
  ['שלמה', 'ציבורי', '28', 'האירוס 6'],
  ['רמב"ם', 'ציבורי', '29', 'לבזובסקי'],
  ['האוצר', 'מקלט בבי"ס תחכמוני', null, 'עפגין 7'],
  ['האוצר', 'ציבורי', '30', 'טיומקין 2'],
  ['הזיתים', 'ציבורי', '31', 'צפרה 3'],
  ['בית"ר', 'ציבורי', '32', 'פרנק 14'],
  ['צומת המשטרה', 'ציבורי קניון מול הכיכר', null, 'דוד שמעוני 42'],
  ['הפועל המזרחי', 'ציבורי', '33', 'רמב"ן 10'],
  ['נווה חיים', 'מקלט בבי"ס מוריה', null, 'עולי הגרדום 1'],
  ['נווה חיים', 'ציבורי', '34', 'אהרונוביץ 7'],
  ['יצחק', 'מקלט בבי"ס אולפנת מבשרת', null, null],
  ['חפציבה', 'ציבורי', '36', 'מבצע חורב'],
  ['גבעת אולגה', 'ציבורי', '37', 'שומרון 7'],
  ['גבעת אולגה', 'ציבורי', '38', 'הקונגרס 12'],
  ['גבעת אולגה', 'ציבורי', '39', 'הנגב 25'],
  ['גבעת אולגה', 'ציבורי', '40', 'הראשונים 12'],
  ['גבעת אולגה', 'ציבורי', '41', 'מבצע עזרא 39'],
  ['גבעת אולגה', 'ציבורי', '42', 'מבצע עזרא 39'],
  ['גבעת אולגה', 'ציבורי', '43', 'שיבת ציון 40'],
  ['גבעת אולגה', 'ציבורי', '44', 'המעפילים 41'],
  ['גבעת אולגה', 'ציבורי', '45', 'אלי כהן 6'],
  ['גבעת אולגה', 'ציבורי', '46', 'אלי כהן 10'],
  ['גבעת אולגה', 'ציבורי', '47', 'אלי כהן 14'],
  ['גבעת אולגה', 'ציבורי', '48', 'אלי כהן 16'],
  ['גבעת אולגה', 'ציבורי', '49', 'אלי כהן'],
  ['גבעת אולגה', 'ציבורי', '50', 'שבטי ישראל'],
  ['גבעת אולגה', 'ציבורי', '51', 'שבטי ישראל 3'],
  ['גבעת אולגה', 'ציבורי', '53', 'התנאים'],
  ['גבעת אולגה', 'ציבורי', '54', 'מלכי ישראל 12'],
  ['גבעת אולגה', 'ציבורי', '55', 'התנאים 22'],
  ['גבעת אולגה', 'ציבורי', '56', 'החלוץ'],
  ['גבעת אולגה', 'ציבורי', '58', 'הגדוד העברי 11'],
  ['גבעת אולגה', 'ציבורי', '59', 'הבריגדה היהודית 15'],
  ['גבעת אולגה', 'מחסה תת קרקעי חניון כפר הים', null, 'שד\' רחבעם זאבי'],
  ['גבעת אולגה', 'מקלט בבי"ס גבעול', null, 'מבצע עזרא 7'],
  ['גבעת אולגה', 'מקלט בבי"ס אור לטף', null, 'הנגב 5'],
  ['גבעת אולגה', 'מקלט בבי"ס יבנה', null, 'הנגב 3'],
  ['גבעת אולגה', 'מתנ"ס ג"א', null, 'הראשונים 2'],
];

function classifyType(typeHeb) {
  if (typeHeb === 'ציבורי') return 'public';
  if (typeHeb.startsWith('ציבורי ')) return 'public'; // e.g. "ציבורי קניון מול הכיכר"
  if (typeHeb.startsWith('מקלט בבי"ס') || typeHeb.startsWith('מקלט בבית ספר')) return 'school';
  if (typeHeb.startsWith('מחסה תת קרקעי')) return 'underground';
  if (typeHeb.startsWith('מתנ"ס') || typeHeb.startsWith('מרכז פנאי')) return 'community';
  return 'public';
}

function buildName(neighborhood, typeHeb, number) {
  if (number) return `מקלט ${number} - ${neighborhood}`;
  // For named shelters use the descriptive name
  return typeHeb;
}

function buildAddress(address) {
  if (!address) return null;
  return `${address}, חדרה`;
}

async function geocode(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const type = data.results[0].geometry.location_type;
    // Skip APPROXIMATE results (city-level, useless)
    if (type === 'APPROXIMATE') return null;
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address, type };
  }
  return null;
}

async function main() {
  const shelters = [];
  let success = 0, fail = 0;

  for (const [neighborhood, typeHeb, number, address] of SHELTERS) {
    const name = buildName(neighborhood, typeHeb, number);
    const displayAddress = buildAddress(address);
    const type = classifyType(typeHeb);

    // Build geocoding query
    let query;
    if (address) {
      query = `${address}, חדרה, ישראל`;
    } else {
      // No address — try geocoding with the descriptive name + city
      query = `${typeHeb}, חדרה, ישראל`;
    }

    const geo = await geocode(query);
    if (geo) {
      shelters.push({
        name,
        address: displayAddress || `${typeHeb}, חדרה`,
        lat: geo.lat,
        lon: geo.lon,
        type,
        source: 'hadera-municipality',
      });
      success++;
      console.log(`OK  ${name}: ${query} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL  ${name}: ${query} -> NO RESULT`);
    }
    // Rate limit: 50ms between requests
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nTotal: ${success} geocoded, ${fail} failed out of ${SHELTERS.length}`);

  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'hadera-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
