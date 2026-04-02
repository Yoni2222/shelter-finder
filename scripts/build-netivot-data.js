// Build Netivot shelter data: clean addresses, geocode, produce output
// Usage: GOOGLE_API_KEY=... node build-netivot-data.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable is required');
  process.exit(1);
}

// Raw shelter data: number|description
const RAW = `
0|אלפסי גב מגדל מים, תת קרקעי
1|גיבורים בסמוך לאבן דנן
2|אלפסי בתוך פארק מיכה
3|אלפסי, בית חב"ד
4|אלפסי על יד 1074 מול ילדי אוסלו
5|אלי כהן בסמוך לבית מספר 59/2
6|חלפון הכוהן מול נתיב אליהו
7|חזון איש מול אוהלי יעקב
8|חזון איש / חלפון הכהן בסמוך למקווה הרה יורם
9|צומת אבוחצירה / חלפון הכהן
10|הרב אל נקווה על יד 507
11|הרב חי הכוהן מול בית מספר 31
12|איש חי בתוך כולל הרב יורם
13|צומת רמב"ם בר אילן
14|בר אילן מול הרשב"י
15|הרשב"י על יד בית 11
16|הרב הרצוג
17|משעול איש מצליח
18|הרב עוזיאל (קצה)
19|מלכי ישראל על יד 24
20|הרב יוסף מלול (אחורי המשטרה)
21|הרב יוסף מלול
22|כניסה לרחוב שבטי ישראל
23|סמילו (שוק ישן)
24|שבטי ישראל סמוך לשיטור עירוני לשעבר
25|רבי עקיבא בסמוך לפיצוחי דני
26|א.ת כיכר בעלי המלאכה
27|בעלי המלאכה, בסמוך לאולמי לוגסי לשעבר
28|בעלי המלאכה, גב אולמי לוגסי.
30|בעלי המלאכה מול מקלט מספר 28
31|בעלי המלאכה, בתוך מפעל גלילית
33|רחוב האומן, מאחורי מוסך עינב
34|רחוב האומן
35|האומן מאחורי משביר לצרכן
36|בעלי המלאכה בסמוך לאולם ברכת שמיים
37|בעלי המלאכה, רשום על מקלט זה כתובת בית מספר 36.
38|בעלי המלאכה, בסמוך לחנות מרכז הברכה
40|נווה נוי רחוב התות 1
41|נווה נוי הגפן 25 בסמוך למכולת "רחל"
42|נווה נוי הגפן 78
43|נווה נוי הגפן 112
44|נווה נוי אשכולית 2
45|נווה נוי תמר 36
46|נווה נוי ערבה 2, בסמוך לבית מספר 13/15
47|נווה נוי מול האתרוג 13
48|נווה נוי צומת תמר/זית
49|נווה נוי הדס 2
50|נווה נוי גויאבה 2, ליד גויאבה12
51|שד' ירושלים 173
52|שד' ירושלים 173
53|שד' ירושלים מול בה"ס נועם אורות , רחוב הרצל 32
54|שד' ירושלים 146
55|שד' ירושלים בגב בה"ס המר רחוב הרב צבאן 6
56|שד' ירושלים 152
57|שדרות ירושלים 222 מול מבנה קונסרבטוריון
58|שד' ירושלים 181
59|שד' וייצמן/גרשונוביץ 6
60|שד' וייצמן 201
61|שד' וייצמן 203
62|שד' וייצמן 205
63|נטעים, חייל ההנדסה41/שריון
64|נטעים, חיל השריון 1 קצה 11 הנקודות
65|נטעים, מפגש חיל התותחנים / הנדסה
66|נטעים, חיל הנדסה
67|נטעים, חיל אוויר על הפינה
68|נטעים, חיל אוויר - מול תותחנים
69|נטעים, חיל האוויר 10
70|גב מבצע קדש 122
71|גב מבצע קדש 105
72|חיד"א 184 בסמוך למקווה זוהרה
73|מול הארי 190
74|שכונת משהב ב' בסמוך לבניין מגורים ז'בוטינסקי 1339
75|משהב ב' בסמוך לבניין מגורים ז'בוטינסקי 1339
76|ז'בוטינסקי בתוך דיור מוגן
77|ז'בוטינסקי בתוך דיור מוגן עד הסוף צד שמאל
`.trim();

const CITY = 'נתיבות';

// ── Step 1: Parse and clean addresses ──

function cleanAddress(num, desc) {
  let addr = desc;

  // Handle "נווה נוי" prefix → extract inner street
  if (addr.startsWith('נווה נוי')) {
    addr = addr.replace(/^נווה נוי\s*/, '');
  }

  // Handle "נטעים," prefix → extract inner street
  if (addr.startsWith('נטעים')) {
    addr = addr.replace(/^נטעים[,،]?\s*/, '');
  }

  // Handle "שכונת משהב ב'" prefix
  addr = addr.replace(/^שכונת משהב ב'\s*/, '');
  addr = addr.replace(/^משהב ב'\s*/, '');

  // Remove descriptive parts (order matters — longer patterns first)
  addr = addr.replace(/בסמוך ל[^\s,.]*/g, '');
  addr = addr.replace(/בסמוך ל/g, '');
  addr = addr.replace(/סמוך ל[^\s,.]*/g, '');
  addr = addr.replace(/סמוך ל/g, '');
  addr = addr.replace(/מול [^\s,.]*(\s[^\s,.]*)?/g, '');
  addr = addr.replace(/גב [^\s,.]*(\s[^\s,.]*)?/g, '');
  addr = addr.replace(/בתוך [^\s,.]*(\s[^\s,.]*)?/g, '');
  addr = addr.replace(/על יד [^\s,.]*(\s[^\s,.]*)?/g, '');
  addr = addr.replace(/מאחורי [^\s,.]*(\s[^\s,.]*)?/g, '');
  addr = addr.replace(/ליד [^\s,.]*(\s[^\s,.]*)?/g, '');

  // Remove parenthetical notes
  addr = addr.replace(/\([^)]*\)/g, '');

  // Remove trailing descriptive phrases after comma
  addr = addr.replace(/,\s*(תת קרקעי|רשום על מקלט.*|עד הסוף.*|קצה.*|בית חב"ד)$/g, '');

  // Remove "רחוב", "שד'", "שדרות" at the beginning
  addr = addr.replace(/^רחוב\s+/, '');

  // Expand שד' to שדרות
  addr = addr.replace(/^שד'\s+/, 'שדרות ');
  addr = addr.replace(/^שדרות\s+/, 'שדרות ');

  // Handle slash — take first street (for intersections) but keep number if after
  if (addr.includes('/')) {
    // Special case: "וייצמן/גרשונוביץ 6" → "שדרות ויצמן 6"  (already cleaned above)
    // General: take first part before /
    const slashParts = addr.split('/');
    // Check if there's a number after the slash part
    const afterSlash = slashParts.slice(1).join('/').trim();
    const numAfterSlash = afterSlash.match(/^[\S]*\s+(\d+)/);
    addr = slashParts[0].trim();
    // If the first part doesn't have a number but second does, append
    if (!/\d+/.test(addr) && numAfterSlash) {
      addr = addr + ' ' + numAfterSlash[1];
    }
  }

  // Handle "כניסה לרחוב" prefix
  addr = addr.replace(/^כניסה ל(רחוב\s+)?/, '');

  // Handle "צומת" prefix
  addr = addr.replace(/^צומת\s+/, '');

  // Handle "א.ת כיכר" prefix
  addr = addr.replace(/^א\.ת\s+(כיכר\s+)?/, '');

  // Handle "מפגש" prefix
  addr = addr.replace(/^מפגש\s+/, '');

  // Extract "בית מספר XX" → number
  const beitMispar = addr.match(/בית מספר\s+(\d+)/);
  if (beitMispar) {
    addr = addr.replace(/בית מספר\s+\d+\S*/, '').trim();
    if (!/\d+/.test(addr)) {
      addr = addr + ' ' + beitMispar[1];
    }
  }

  // Extract "בית XX" → number
  const beit = addr.match(/\bבית\s+(\d+)/);
  if (beit) {
    addr = addr.replace(/\bבית\s+\d+/, '').trim();
    if (!/\d+/.test(addr)) {
      addr = addr + ' ' + beit[1];
    }
  }

  // Clean up punctuation, extra whitespace, commas
  addr = addr.replace(/[,،.]+/g, ' ');
  addr = addr.replace(/\s+/g, ' ').trim();
  addr = addr.replace(/-\s*$/, '').trim();

  // Remove trailing descriptive words left over
  addr = addr.replace(/\s+(לשעבר|על הפינה)$/g, '');

  return addr;
}

// Special manual overrides for tricky addresses
const OVERRIDES = {
  0: 'אלפסי',
  1: 'גיבורים',
  2: 'אלפסי',
  3: 'אלפסי',
  4: 'אלפסי 1074',
  5: 'אלי כהן 59',
  6: 'חלפון הכוהן',
  7: 'חזון איש',
  8: 'חזון איש',
  9: 'אבוחצירה',
  10: 'הרב אל נקווה 507',
  11: 'הרב חי הכוהן 31',
  12: 'איש חי',
  13: 'רמב"ם',
  14: 'בר אילן',
  15: 'הרשב"י 11',
  16: 'הרב הרצוג',
  17: 'משעול איש מצליח',
  18: 'הרב עוזיאל',
  19: 'מלכי ישראל 24',
  20: 'הרב יוסף מלול',
  21: 'הרב יוסף מלול',
  22: 'שבטי ישראל',
  23: 'סמילו',
  24: 'שבטי ישראל',
  25: 'רבי עקיבא',
  26: 'בעלי המלאכה',
  27: 'בעלי המלאכה',
  28: 'בעלי המלאכה',
  30: 'בעלי המלאכה',
  31: 'בעלי המלאכה',
  33: 'האומן',
  34: 'האומן',
  35: 'האומן',
  36: 'בעלי המלאכה',
  37: 'בעלי המלאכה 36',
  38: 'בעלי המלאכה',
  40: 'התות 1',
  41: 'הגפן 25',
  42: 'הגפן 78',
  43: 'הגפן 112',
  44: 'אשכולית 2',
  45: 'תמר 36',
  46: 'ערבה 2',
  47: 'האתרוג 13',
  48: 'תמר',
  49: 'הדס 2',
  50: 'גויאבה 2',
  51: 'שדרות ירושלים 173',
  52: 'שדרות ירושלים 173',
  53: 'הרצל 32',
  54: 'שדרות ירושלים 146',
  55: 'הרב צבאן 6',
  56: 'שדרות ירושלים 152',
  57: 'שדרות ירושלים 222',
  58: 'שדרות ירושלים 181',
  59: 'שדרות ויצמן 6',
  60: 'שדרות ויצמן 201',
  61: 'שדרות ויצמן 203',
  62: 'שדרות ויצמן 205',
  63: 'חיל ההנדסה 41',
  64: 'חיל השריון 1',
  65: 'חיל התותחנים',
  66: 'חיל הנדסה',
  67: 'חיל אוויר',
  68: 'חיל אוויר',
  69: 'חיל האוויר 10',
  70: 'מבצע קדש 122',
  71: 'מבצע קדש 105',
  72: 'חיד"א 184',
  73: 'הארי 190',
  74: 'ז\'בוטינסקי 1339',
  75: 'ז\'בוטינסקי 1339',
  76: 'ז\'בוטינסקי',
  77: 'ז\'בוטינסקי',
};

// Parse raw data
const shelters = RAW.split('\n').map(line => {
  const [numStr, desc] = line.split('|');
  const num = parseInt(numStr.trim());
  const description = desc.trim();
  const address = OVERRIDES[num] !== undefined ? OVERRIDES[num] : cleanAddress(num, description);
  return { num, description, address };
});

console.log(`Parsed ${shelters.length} shelters\n`);
console.log('Cleaned addresses:');
shelters.forEach(s => {
  console.log(`  ${s.num}: "${s.description}" → "${s.address}"`);
});

// ── Step 2: Write input JSON ──

const inputData = shelters.map(s => ({
  name: `מקלט ${s.num}`,
  address: s.address,
  city: CITY,
}));

const SCRIPTS_DIR = path.dirname(__filename);
const INPUT_FILE = path.join(SCRIPTS_DIR, 'netivot-input.json');
const OUTPUT_FILE = path.join(SCRIPTS_DIR, 'netivot-output.json');
const DATA_FILE = path.join(SCRIPTS_DIR, '..', 'data', 'netivot-shelters.json');

fs.writeFileSync(INPUT_FILE, JSON.stringify(inputData, null, 2), 'utf8');
console.log(`\nWrote ${INPUT_FILE}`);

// ── Step 3: Geocode ──

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function geocodeOnce(address) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.results.length > 0) {
            const loc = result.results[0].geometry.location;
            resolve({ lat: loc.lat, lon: loc.lng, formatted: result.results[0].formatted_address });
          } else if (result.status === 'OVER_QUERY_LIMIT') {
            reject(new Error('RATE_LIMITED'));
          } else {
            resolve(null);
          }
        } catch (e) { reject(new Error('PARSE_ERROR')); }
      });
    }).on('error', reject);
  });
}

async function geocode(address, retries) {
  retries = retries || 3;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await geocodeOnce(address);
    } catch (e) {
      if (e.message === 'RATE_LIMITED' || e.message === 'PARSE_ERROR') {
        const wait = 2000 * (attempt + 1);
        console.log(`    Retrying in ${wait/1000}s...`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
  return null;
}

// Validate coordinates are in Netivot area
function isInNetivot(lat, lon) {
  return lat >= 31.40 && lat <= 31.44 && lon >= 34.57 && lon <= 34.62;
}

// Remove house number from address
function stripNumber(addr) {
  return addr.replace(/\s+\d+\S*$/, '').trim();
}

async function main() {
  const results = [];
  let ok = 0, fail = 0;
  const failures = [];

  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    const fullQuery = `${s.address}, ${CITY}`;

    let geo = await geocode(fullQuery);

    // Validate location
    if (geo && !isInNetivot(geo.lat, geo.lon)) {
      console.log(`    [${i+1}/${shelters.length}] Out of bounds: ${s.address} → ${geo.lat}, ${geo.lon} (${geo.formatted})`);
      geo = null;
    }

    // Fallback: try without house number
    if (!geo && /\d+/.test(s.address)) {
      const streetOnly = stripNumber(s.address);
      const fallbackQuery = `${streetOnly}, ${CITY}`;
      console.log(`    Fallback: "${fallbackQuery}"`);
      geo = await geocode(fallbackQuery);
      if (geo && !isInNetivot(geo.lat, geo.lon)) {
        console.log(`    Fallback out of bounds: ${geo.lat}, ${geo.lon}`);
        geo = null;
      }
      await sleep(200);
    }

    if (geo) {
      results.push({
        id: `נתיבות-${s.num}`,
        lat: geo.lat,
        lon: geo.lon,
        name: `מקלט ${s.num}`,
        address: s.address,
        city: CITY,
        neighborhood: '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
      });
      ok++;
      console.log(`  [${i+1}/${shelters.length}] OK מקלט ${s.num} → ${geo.lat}, ${geo.lon} (${geo.formatted})`);
    } else {
      fail++;
      failures.push({ num: s.num, address: s.address, description: s.description });
      console.log(`  [${i+1}/${shelters.length}] FAIL מקלט ${s.num} (${fullQuery})`);
    }

    await sleep(200);
  }

  // ── Step 4: Write outputs ──
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2), 'utf8');

  // ── Step 5: Print results ──
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${ok} geocoded, ${fail} failed out of ${shelters.length} total`);
  console.log(`Saved to:\n  ${OUTPUT_FILE}\n  ${DATA_FILE}`);

  if (failures.length > 0) {
    console.log(`\nFailed shelters:`);
    failures.forEach(f => {
      console.log(`  מקלט ${f.num}: "${f.description}" (cleaned: "${f.address}")`);
    });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
