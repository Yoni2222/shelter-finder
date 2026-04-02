'use strict';
/**
 * Build Safed (צפת) shelters data.
 * Source: Municipality website - ~95 public shelters (excluding industrial area).
 * This script:
 *   1. Creates safed-input.json from raw data
 *   2. Geocodes via Google Geocoding API
 *   3. Writes safed-output.json and data/safed-shelters.json
 *
 * Run: node scripts/build-safed-data.js
 */

const fs = require('fs'), path = require('path');
const https = require('https');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = envFile.match(/GOOGLE_MAPS_API_KEY=(.+)/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
})();

// Raw data: shelterNumber|neighborhood|rawAddress|cleanAddress (for geocoding)
const RAW_DATA = [
  // === עיר עתיקה (Old City) ===
  { num: 'ע2',  hood: 'עיר עתיקה', addr: 'תרפ"ט',                    geocodeAddr: 'רחוב תרפ"ט' },
  { num: 'ע3',  hood: 'עיר עתיקה', addr: 'ירושלים 50 מול העירייה',     geocodeAddr: 'ירושלים 50' },
  { num: 'ע5',  hood: 'עיר עתיקה', addr: 'קרית האמנים',               geocodeAddr: 'קרית האמנים' },
  { num: 'ע6',  hood: 'עיר עתיקה', addr: 'מתחם בי"ס אלשייך',          geocodeAddr: 'בית ספר אלשייך' },
  { num: 'ע7',  hood: 'עיר עתיקה', addr: 'סמטת הדסה',                 geocodeAddr: 'סמטת הדסה' },
  { num: 'ע8',  hood: 'עיר עתיקה', addr: 'הנשיא 58',                  geocodeAddr: 'הנשיא 58' },
  { num: 'ע9',  hood: 'עיר עתיקה', addr: 'האר"י 13',                  geocodeAddr: 'האר"י 13' },
  { num: 'ע10', hood: 'עיר עתיקה', addr: 'סמוך לחאן אדום',            geocodeAddr: 'האר"י 22' },
  { num: 'ע11', hood: 'עיר עתיקה', addr: 'חטיבת יפתח - מתחת למצודה',  geocodeAddr: 'חטיבת יפתח' },
  { num: 'ע12', hood: 'עיר עתיקה', addr: 'חטיבת יפתח - מתחת למצודה',  geocodeAddr: 'חטיבת יפתח' },

  // === שכונת כנען ===
  { num: 'כ1',  hood: 'שכונת כנען', addr: 'זלמן שז"ר סמוך לגן כיפות',                    geocodeAddr: 'זלמן שזר' },
  { num: 'כ2',  hood: 'שכונת כנען', addr: 'השבעה ליד בית כנסת רבי עמרם',                   geocodeAddr: 'השבעה' },
  { num: 'כ3',  hood: 'שכונת כנען', addr: 'השבעה 205',                                     geocodeAddr: 'השבעה 205' },
  { num: 'כ4',  hood: 'שכונת כנען', addr: 'ליד בית הכנסת יוספטל',                           geocodeAddr: 'יוספטל' },
  { num: 'כ5',  hood: 'שכונת כנען', addr: 'יוספטל 23',                                     geocodeAddr: 'יוספטל 23' },
  { num: 'כ6',  hood: 'שכונת כנען', addr: 'יוספטל 37',                                     geocodeAddr: 'יוספטל 37' },
  { num: 'כ7',  hood: 'שכונת כנען', addr: 'יוספטל 32',                                     geocodeAddr: 'יוספטל 32' },
  { num: 'כ8',  hood: 'שכונת כנען', addr: 'יוספטל 4',                                      geocodeAddr: 'יוספטל 4' },
  { num: 'כ9',  hood: 'שכונת כנען', addr: 'קיבוץ גלויות 49',                               geocodeAddr: 'קיבוץ גלויות 49' },
  { num: 'כ10', hood: 'שכונת כנען', addr: 'זלמן שז"ר טיפת חלב',                            geocodeAddr: 'זלמן שזר' },
  { num: 'כ11', hood: 'שכונת כנען', addr: 'השבעה מול הכניסה למתנ"ס',                        geocodeAddr: 'השבעה' },
  { num: 'כ12', hood: 'שכונת כנען', addr: 'שכונת כנען מתחת למגרש (ביהכ"ס אבוחצירא)',        geocodeAddr: 'בית ספר אבוחצירא' },
  { num: 'כ13', hood: 'שכונת כנען', addr: 'מתחת בית הכנסת (אחרי 231)',                      geocodeAddr: 'שכונת כנען' },
  { num: 'כ14', hood: 'שכונת כנען', addr: 'בית הקשיש',                                     geocodeAddr: 'בית הקשיש כנען' },
  { num: 'כ15', hood: 'שכונת כנען', addr: 'ביה"ס חב"ד בנים',                               geocodeAddr: 'בית ספר חבד' },

  // === מנחם בגין ===
  { num: 'ב1',  hood: 'מנחם בגין', addr: 'מנחם בגין 33 בית כנסת',  geocodeAddr: 'מנחם בגין 33' },
  { num: 'ב2',  hood: 'מנחם בגין', addr: 'האגוז 9 בית כנסת',       geocodeAddr: 'האגוז 9' },
  { num: 'ב3',  hood: 'מנחם בגין', addr: 'מנחם בגין 80 בית כנסת',  geocodeAddr: 'מנחם בגין 80' },
  { num: 'ב4',  hood: 'מנחם בגין', addr: 'המכבים 6',               geocodeAddr: 'המכבים 6' },
  { num: 'ב5',  hood: 'מנחם בגין', addr: 'ליד בית 135 טיפת חלב',   geocodeAddr: 'מנחם בגין 135' },
  { num: 'ב6',  hood: 'מנחם בגין', addr: 'הקציר 16',               geocodeAddr: 'הקציר 16' },
  { num: 'ב7',  hood: 'מנחם בגין', addr: 'הנחלים 6',               geocodeAddr: 'הנחלים 6' },
  { num: 'ב8',  hood: 'מנחם בגין', addr: 'הנחלים 6',               geocodeAddr: 'הנחלים 6' },
  { num: 'ב9',  hood: 'מנחם בגין', addr: 'הסביון 5 בית כנסת',      geocodeAddr: 'הסביון 5' },
  { num: 'ב10', hood: 'מנחם בגין', addr: 'הדרור 9',                geocodeAddr: 'הדרור 9' },
  { num: 'ב11', hood: 'מנחם בגין', addr: 'הפרחים 1',               geocodeAddr: 'הפרחים 1' },
  { num: 'ב12', hood: 'מנחם בגין', addr: 'הפרחים 10',              geocodeAddr: 'הפרחים 10' },
  { num: 'ב13', hood: 'מנחם בגין', addr: 'שבעת המינים 11',         geocodeAddr: 'שבעת המינים 11' },
  { num: 'ב14', hood: 'מנחם בגין', addr: 'שבעת המינים 1',          geocodeAddr: 'שבעת המינים 1' },
  { num: 'ב15', hood: 'מנחם בגין', addr: 'הירדן 20',               geocodeAddr: 'הירדן 20' },

  // === דרום העיר (South) ===
  { num: 'ד1',  hood: 'דרום העיר', addr: 'גמזו סמוך לקבר',                          geocodeAddr: 'גמזו' },
  { num: 'ד2',  hood: 'דרום העיר', addr: 'הנשיא ליד גן מייזי',                       geocodeAddr: 'הנשיא' },
  { num: 'ד3',  hood: 'דרום העיר', addr: 'הרצל 9',                                  geocodeAddr: 'הרצל 9' },
  { num: 'ד4',  hood: 'דרום העיר', addr: 'מ"ג יורדי הסירה',                           geocodeAddr: 'יורדי הסירה' },
  { num: 'ד5',  hood: 'דרום העיר', addr: 'שפרינצק 157',                              geocodeAddr: 'שפרינצק 157' },
  { num: 'ד6',  hood: 'דרום העיר', addr: 'דוד רמז 154',                              geocodeAddr: 'דוד רמז 154' },
  { num: 'ד7',  hood: 'דרום העיר', addr: 'דוד רמז 208',                              geocodeAddr: 'דוד רמז 208' },
  { num: 'ד8',  hood: 'דרום העיר', addr: 'ויצמן 5 בתוך גן האם',                      geocodeAddr: 'ויצמן 5' },
  { num: 'ד9',  hood: 'דרום העיר', addr: 'אנילביץ מתחת לבית כנסת סאסי',              geocodeAddr: 'אנילביץ' },
  { num: 'ד10', hood: 'דרום העיר', addr: 'לוחמי הגיטאות 22',                          geocodeAddr: 'לוחמי הגיטאות 22' },
  { num: 'ד11', hood: 'דרום העיר', addr: 'לוחמי הגיטאות 21',                          geocodeAddr: 'לוחמי הגיטאות 21' },
  { num: 'ד12', hood: 'דרום העיר', addr: 'לוחמי הגיטאות ליד בית כנסת זבולון',         geocodeAddr: 'לוחמי הגיטאות' },
  { num: 'ד13', hood: 'דרום העיר', addr: 'רחוב ה-11 301',                             geocodeAddr: 'רחוב 11' },
  { num: 'ד14', hood: 'דרום העיר', addr: 'לוחמי הגיטאות 35',                          geocodeAddr: 'לוחמי הגיטאות 35' },
  { num: 'ד15', hood: 'דרום העיר', addr: 'דוד רמז מול בניין 103',                     geocodeAddr: 'דוד רמז 103' },
  { num: 'ד16', hood: 'דרום העיר', addr: 'לוחמי הגיטאות 44',                          geocodeAddr: 'לוחמי הגיטאות 44' },
  { num: 'ד17', hood: 'דרום העיר', addr: 'לוחמי הגיטאות 42',                          geocodeAddr: 'לוחמי הגיטאות 42' },
  { num: 'ד18', hood: 'דרום העיר', addr: 'דוד רמז 54',                               geocodeAddr: 'דוד רמז 54' },
  { num: 'ד19', hood: 'דרום העיר', addr: 'דוד רמז 90',                               geocodeAddr: 'דוד רמז 90' },
  { num: 'ד20', hood: 'דרום העיר', addr: 'דוד רמז 92',                               geocodeAddr: 'דוד רמז 92' },
  { num: 'ד21', hood: 'דרום העיר', addr: 'דוד רמז 99',                               geocodeAddr: 'דוד רמז 99' },
  { num: 'ד22', hood: 'דרום העיר', addr: 'דוד רמז 101',                              geocodeAddr: 'דוד רמז 101' },
  { num: 'ד23', hood: 'דרום העיר', addr: 'ויצמן 10',                                 geocodeAddr: 'ויצמן 10' },
  { num: 'ד24', hood: 'דרום העיר', addr: 'פרמצקו שיכון רופאים',                       geocodeAddr: 'שיכון רופאים' },
  { num: 'ד25', hood: 'דרום העיר', addr: 'דוד רמז צמוד למכולת מיקי ג\'אן',            geocodeAddr: 'דוד רמז' },

  // === רמת רזים ===
  { num: 'ר1',  hood: 'רמת רזים', addr: 'הגולן 1',                    geocodeAddr: 'הגולן 1' },
  { num: 'ר2',  hood: 'רמת רזים', addr: 'הגולן 13',                   geocodeAddr: 'הגולן 13' },
  { num: 'ר3',  hood: 'רמת רזים', addr: 'הגולן 2 בית כנסת',           geocodeAddr: 'הגולן 2' },
  { num: 'ר4',  hood: 'רמת רזים', addr: 'הגולן 6',                    geocodeAddr: 'הגולן 6' },
  { num: 'ר5',  hood: 'רמת רזים', addr: 'הגולן 17',                   geocodeAddr: 'הגולן 17' },
  { num: 'ר6',  hood: 'רמת רזים', addr: 'התבור 5',                    geocodeAddr: 'התבור 5' },
  { num: 'ר7',  hood: 'רמת רזים', addr: 'התבור 9',                    geocodeAddr: 'התבור 9' },
  { num: 'ר8',  hood: 'רמת רזים', addr: 'התבור 17',                   geocodeAddr: 'התבור 17' },
  { num: 'ר9',  hood: 'רמת רזים', addr: 'התבור 4',                    geocodeAddr: 'התבור 4' },
  { num: 'ר10', hood: 'רמת רזים', addr: 'התבור 12',                   geocodeAddr: 'התבור 12' },
  { num: 'ר11', hood: 'רמת רזים', addr: 'התבור 20',                   geocodeAddr: 'התבור 20' },
  { num: 'ר12', hood: 'רמת רזים', addr: 'התבור 26',                   geocodeAddr: 'התבור 26' },
  { num: 'ר13', hood: 'רמת רזים', addr: 'החרמון 1',                   geocodeAddr: 'החרמון 1' },
  { num: 'ר14', hood: 'רמת רזים', addr: 'החרמון 7',                   geocodeAddr: 'החרמון 7' },
  { num: 'ר15', hood: 'רמת רזים', addr: 'החרמון 55 בית כנסת',         geocodeAddr: 'החרמון 55' },
  { num: 'ר16', hood: 'רמת רזים', addr: 'החרמון 23 בית כנסת',         geocodeAddr: 'החרמון 23' },
  { num: 'ר17', hood: 'רמת רזים', addr: 'החרמון 54',                  geocodeAddr: 'החרמון 54' },
  { num: 'ר18', hood: 'רמת רזים', addr: 'החרמון 8',                   geocodeAddr: 'החרמון 8' },
  { num: 'ר19', hood: 'רמת רזים', addr: 'החרמון 16',                  geocodeAddr: 'החרמון 16' },
  { num: 'ר20', hood: 'רמת רזים', addr: 'החרמון 24',                  geocodeAddr: 'החרמון 24' },
  { num: 'ר21', hood: 'רמת רזים', addr: 'החרמון 34',                  geocodeAddr: 'החרמון 34' },

  // === איביקור ===
  { num: 'א1',  hood: 'איביקור', addr: 'הנשרים ליד בית 364',          geocodeAddr: 'הנשרים' },
  { num: 'א2',  hood: 'איביקור', addr: 'חוחית ליד בית 343',           geocodeAddr: 'חוחית' },
  { num: 'א3',  hood: 'איביקור', addr: 'חוחית ליד בית 356',           geocodeAddr: 'חוחית' },
  { num: 'א4',  hood: 'איביקור', addr: 'התור ליד בית 415',            geocodeAddr: 'התור' },
  { num: 'א5',  hood: 'איביקור', addr: 'זמיר ליד בית 394',            geocodeAddr: 'זמיר' },
  { num: 'א6',  hood: 'איביקור', addr: 'יסעור ליד בית 421',           geocodeAddr: 'יסעור' },
  { num: 'א7',  hood: 'איביקור', addr: 'זמיר ליד בית 400',            geocodeAddr: 'זמיר' },
  { num: 'א8',  hood: 'איביקור', addr: 'זמיר ליד בית 453',            geocodeAddr: 'זמיר' },
  { num: 'א9',  hood: 'איביקור', addr: 'הנשרים ליד בית 472',          geocodeAddr: 'הנשרים' },
  { num: 'א10', hood: 'איביקור', addr: 'הנשרים ליד בית 491',          geocodeAddr: 'הנשרים' },
  { num: 'א11', hood: 'איביקור', addr: 'הנץ ליד תיבות הדואר',         geocodeAddr: 'הנץ' },
  { num: 'א12', hood: 'איביקור', addr: 'הנץ ליד תיבות הדואר',         geocodeAddr: 'הנץ' },
];

// Safed bounding box (approx)
function inSafedBounds(lat, lon) {
  return lat >= 32.93 && lat <= 33.00 && lon >= 35.47 && lon <= 35.53;
}

function geocode(address) {
  const query = `${address}, צפת, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;

  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.results.length > 0) {
            const loc = result.results[0].geometry.location;
            const addressEn = result.results[0].formatted_address || '';
            resolve({ lat: loc.lat, lon: loc.lng, addressEn });
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geocodeWithRetry(address, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await geocode(address);
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

async function main() {
  if (!GOOGLE_API_KEY) {
    console.error('ERROR: No Google API key. Set GOOGLE_API_KEY or add to .env');
    process.exit(1);
  }

  console.log(`Geocoding ${RAW_DATA.length} shelters in צפת...`);
  const shelters = [];
  const failures = [];
  const outOfBounds = [];

  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.geocodeAddr);

    if (!coords) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr} (query: ${e.geocodeAddr})`);
    } else if (!inSafedBounds(coords.lat, coords.lon)) {
      outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon });
      console.warn(`  [${i+1}/${RAW_DATA.length}] OUT OF BOUNDS: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    } else {
      shelters.push({
        id: `צפת-${shelters.length + 1}`,
        lat: coords.lat,
        lon: coords.lon,
        name: `מקלט ${e.num}`,
        address: e.addr,
        city: 'צפת',
        neighborhood: e.hood,
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
        addressEn: coords.addressEn || '',
      });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    }

    await sleep(200);
  }

  // Write outputs
  const outputPath = path.join(__dirname, 'safed-output.json');
  fs.writeFileSync(outputPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${outputPath}`);

  const dataPath = path.join(__dirname, '..', 'data', 'safed-shelters.json');
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${dataPath}`);

  // Stats
  console.log(`\n=== STATS ===`);
  console.log(`Total: ${RAW_DATA.length}`);
  console.log(`Geocoded OK: ${shelters.length}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Out of bounds: ${outOfBounds.length}`);

  if (failures.length > 0) {
    console.log(`\nFailed addresses:`);
    failures.forEach(f => console.log(`  - ${f.num}: ${f.addr} (query: ${f.geocodeAddr})`));
  }
  if (outOfBounds.length > 0) {
    console.log(`\nOut-of-bounds (excluded):`);
    outOfBounds.forEach(o => console.log(`  - ${o.num}: ${o.addr} -> (${o.lat}, ${o.lon})`));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
