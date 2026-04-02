'use strict';
/**
 * Build Tiberias (טבריה) shelters data.
 * Source: Municipality document - ~150 public shelters.
 * Run: node scripts/build-tiberias-data.js
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

// Raw data from municipality document
// Format: { num, addr, hood }
const RAW_DATA = [
  // שיכון א' / מרכז העיר
  { num: '1',   addr: 'טולדנו 12',                                 hood: 'שיכון א' },
  { num: '2',   addr: 'טולדנו 20',                                 hood: 'שיכון א' },
  { num: '3',   addr: 'טולדנו 18',                                 hood: 'שיכון א' },
  { num: '4',   addr: 'טולדנו',                                    hood: 'שיכון א' },
  { num: '5',   addr: 'טולדנו 79',                                 hood: 'שיכון א' },
  { num: '6',   addr: 'טולדנו 50',                                 hood: 'שיכון א' },
  { num: '7',   addr: 'השילוח 96',                                 hood: 'שיכון א' },
  { num: '8',   addr: 'התבור',                                     hood: 'שכונת אחווה' },
  { num: '9',   addr: 'השילוח',                                    hood: 'שיכון א' },
  { num: '10',  addr: 'הפרחים',                                    hood: 'מרכז העיר' },
  { num: '11',  addr: 'חניון קיסר',                                hood: 'מרכז העיר' },
  { num: '12',  addr: 'יהודה הלוי',                                hood: 'מרכז העיר' },
  { num: '16',  addr: 'משה הכהן 39',                               hood: 'שיכון א' },
  { num: '17',  addr: 'טולדנו 80',                                 hood: 'שיכון א' },
  { num: '18',  addr: 'הר השקדים',                                 hood: 'דייגים' },
  { num: '19',  addr: 'משה הכהן 37',                               hood: 'שיכון א' },
  { num: '25',  addr: 'יוחנן בן זכאי',                             hood: 'מרכז העיר' },
  { num: '26',  addr: 'הפלמ"ח 10',                                 hood: 'מרכז העיר' },
  { num: '27',  addr: 'מצדה',                                      hood: 'שיכון ותיקים' },
  { num: '28',  addr: 'הצנחנים 28',                                hood: 'שיכון ותיקים' },
  { num: '29',  addr: 'גוש עציון 11',                              hood: 'שיכון ותיקים' },
  { num: '30',  addr: 'כיח',                                       hood: 'שיכון ותיקים' },
  { num: '31',  addr: 'אלחדיף',                                    hood: 'מרכז העיר' },
  // מרכז / עיר עתיקה
  { num: '40',  addr: 'טבור הארץ 5',                               hood: 'מרכז העיר' },
  { num: '41',  addr: 'ז\'בוטינסקי',                               hood: 'מרכז העיר' },
  { num: '42',  addr: 'מודיעין 774',                               hood: 'מרכז העיר' },
  { num: '43',  addr: 'אוהל יעקב 26',                              hood: 'מרכז העיר' },
  { num: '44',  addr: 'הרצל',                                      hood: 'מרכז העיר' },
  { num: '45',  addr: 'רוטשילד 5',                                 hood: 'מרכז העיר' },
  { num: '46',  addr: 'רש"י',                                      hood: 'מרכז העיר' },
  { num: '47',  addr: 'יהודה הנשיא 4',                             hood: 'מרכז העיר' },
  { num: '48',  addr: 'יהודה הנשיא 12',                            hood: 'מרכז העיר' },
  { num: '49',  addr: 'רחל',                                       hood: 'מרכז העיר' },
  { num: '50',  addr: 'אחוזת בית',                                 hood: 'מרכז העיר' },
  { num: '51',  addr: 'זיידל 5',                                   hood: 'מרכז העיר' },
  { num: '52',  addr: 'גולומב 9',                                  hood: 'מרכז העיר' },
  { num: '53',  addr: 'דוב הוז 9',                                 hood: 'מרכז העיר' },
  { num: '54',  addr: 'דוב הוז 10',                                hood: 'מרכז העיר' },
  { num: '55',  addr: 'שופטים 50',                                 hood: 'מרכז העיר' },
  { num: '58',  addr: 'ורנר',                                      hood: 'מרכז העיר' },
  { num: '65',  addr: 'טרומפלדור',                                 hood: 'מרכז העיר' },
  // שיכון ב'
  { num: '66',  addr: 'בית וגן 11',                                hood: 'שיכון ב' },
  { num: '67',  addr: 'בית וגן 12',                                hood: 'שיכון ב' },
  { num: '68',  addr: 'שטרית 105',                                 hood: 'שיכון ב' },
  { num: '69',  addr: 'שטרית 35',                                  hood: 'שיכון ב' },
  { num: '70',  addr: 'שטרית 39',                                  hood: 'שיכון ב' },
  { num: '71',  addr: 'מצדה 61',                                   hood: 'שיכון ב' },
  { num: '72',  addr: 'מצדה 50',                                   hood: 'שיכון ב' },
  { num: '73',  addr: 'מצדה 69',                                   hood: 'שיכון ב' },
  { num: '74',  addr: 'בית ספר מקיף עמל',                          hood: 'שיכון ב' },
  { num: '75',  addr: 'בית ספר מח"ט',                              hood: 'שיכון ב' },
  { num: '76',  addr: 'מצדה 50',                                   hood: 'שיכון ב' },
  { num: '77',  addr: 'שטרית 100',                                 hood: 'שיכון ב' },
  { num: '78',  addr: 'בית ספר ארליך',                              hood: 'שיכון ב' },
  { num: '79',  addr: 'בית ספר כינר',                               hood: 'שיכון ב' },
  { num: '80',  addr: 'שטרית 17',                                  hood: 'שיכון ב' },
  { num: '81',  addr: 'בית ספר אולפנית',                            hood: 'שיכון ב' },
  { num: '82',  addr: 'בית ספר עמל',                                hood: 'שיכון ב' },
  { num: '83',  addr: 'בית ספר הר נוף',                             hood: 'שיכון ב' },
  { num: '84',  addr: 'בית ספר נופרים',                             hood: 'שיכון ב' },
  { num: '85',  addr: 'בית ספר איילת השחר',                         hood: 'שיכון ב' },
  { num: '86',  addr: 'בית ספר אורות נרייה',                        hood: 'שיכון ב' },
  { num: '87',  addr: 'הישיבה התיכונית',                            hood: 'שיכון ב' },
  { num: '88',  addr: 'בית ספר עמל במעלה',                          hood: 'שיכון ב' },
  // שיכון ג'
  { num: '100', addr: 'הנביאים 29',                                hood: 'שיכון ג' },
  { num: '101', addr: 'אלנטאון 74',                                hood: 'שיכון ג' },
  { num: '102', addr: 'בית ספר איילים',                             hood: 'שיכון ג' },
  { num: '103', addr: 'אלנטאון',                                   hood: 'שיכון ג' },
  { num: '104', addr: 'ירושלים 716',                               hood: 'שיכון ג' },
  { num: '105', addr: 'יפה נוף 735',                               hood: 'שיכון ג' },
  { num: '106', addr: 'יפה נוף 723',                               hood: 'שיכון ג' },
  { num: '107', addr: 'הנביאים 77',                                hood: 'שיכון ג' },
  { num: '108', addr: 'אהבת ציון 223',                             hood: 'שיכון ג' },
  { num: '109', addr: 'אהבת ציון 266',                             hood: 'שיכון ג' },
  { num: '110', addr: 'אהבת ציון 228',                             hood: 'שיכון ג' },
  { num: '111', addr: 'אהבת ציון 280',                             hood: 'שיכון ג' },
  { num: '112', addr: 'השלום 13',                                  hood: 'שיכון ג' },
  { num: '113', addr: 'השלום 22',                                  hood: 'שיכון ג' },
  { num: '114', addr: 'מתנ"ס אופק',                                hood: 'שיכון ג' },
  { num: '115', addr: 'ברץ 390',                                   hood: 'שיכון ג' },
  { num: '116', addr: 'ברץ 25',                                    hood: 'שיכון ג' },
  { num: '117', addr: 'כהנא 588',                                  hood: 'שיכון ג' },
  { num: '118', addr: 'בית ספר בית יוסף בנות',                      hood: 'שיכון ג' },
  { num: '119', addr: 'בית ספר בית יוסף בנים',                      hood: 'שיכון ג' },
  { num: '120', addr: 'בית ספר יד אליהו',                           hood: 'שיכון ג' },
  { num: '121', addr: 'חזון איש',                                  hood: 'שיכון ג' },
  { num: '122', addr: 'בית ספר חב"ד בנות',                          hood: 'שיכון ג' },
  { num: '123', addr: 'האבות 414',                                 hood: 'שיכון ג' },
  { num: '124', addr: 'ברץ 9',                                     hood: 'שיכון ג' },
  { num: '125', addr: 'יפתח גלעדי 11',                             hood: 'שיכון ג' },
  { num: '126', addr: 'עזרא 7',                                    hood: 'שיכון ג' },
  { num: '127', addr: 'חיים משה שפירא 56',                          hood: 'שיכון ג' },
  { num: '128', addr: 'משה שפירא 24',                               hood: 'שיכון ג' },
  { num: '129', addr: 'משה שפירא 467',                              hood: 'שיכון ג' },
  { num: '130', addr: 'ירושלים 689',                                hood: 'שיכון ג' },
  { num: '131', addr: 'חיים שפירא 40',                              hood: 'שיכון ג' },
  // אזור תעשייה / שיכון ד'
  { num: '149', addr: 'אזור התעשייה טבריה עילית',                   hood: 'אזור תעשייה' },
  { num: '150', addr: 'ז\'בוטינסקי 28',                             hood: 'שיכון ד' },
  { num: '151', addr: 'ז\'בוטינסקי 22',                             hood: 'שיכון ד' },
  { num: '152', addr: 'ז\'בוטינסקי 1018',                           hood: 'שיכון ד' },
  { num: '154', addr: 'ז\'בוטינסקי 1012',                           hood: 'שיכון ד' },
  { num: '155', addr: 'ז\'בוטינסקי 1071',                           hood: 'שיכון ד' },
  { num: '156', addr: 'ז\'בוטינסקי 4',                              hood: 'שיכון ד' },
  { num: '157', addr: 'ז\'בוטינסקי 1072',                           hood: 'שיכון ד' },
  { num: '158', addr: 'ז\'בוטינסקי 1077',                           hood: 'שיכון ד' },
  { num: '159', addr: 'רזיאל 802',                                 hood: 'שיכון ד' },
  { num: '160', addr: 'הרב קוק 838',                               hood: 'שיכון ד' },
  { num: '161', addr: 'הרב קוק 843',                               hood: 'שיכון ד' },
  { num: '162', addr: 'חנה סנש 825',                               hood: 'שיכון ד' },
  { num: '163', addr: 'רזיאל 7',                                   hood: 'שיכון ד' },
  { num: '164', addr: 'אלפסי 846',                                 hood: 'שיכון ד' },
  { num: '165', addr: 'יצחק בן צבי 855',                           hood: 'שיכון ד' },
  { num: '166', addr: 'יצחק בן צבי 1007',                          hood: 'שיכון ד' },
  { num: '167', addr: 'יצחק בן צבי 1010',                          hood: 'שיכון ד' },
  { num: '168', addr: 'יצחק בן צבי 1003',                          hood: 'שיכון ד' },
  { num: '169', addr: 'כלנית',                                     hood: 'שיכון ד' },
  { num: '170', addr: 'בית ספר רבי עקיבא',                          hood: 'שיכון ד' },
  { num: '171', addr: 'בית ספר ענבלים',                             hood: 'שיכון ד' },
  { num: '172', addr: 'סיני 1055',                                 hood: 'שיכון ד' },
  { num: '173', addr: 'שרת 71',                                    hood: 'שיכון ד' },
  { num: '174', addr: 'אבוחצירה 1070',                             hood: 'שיכון ד' },
  { num: '175', addr: 'בית ספר נועם בנים',                          hood: 'שיכון ד' },
  { num: '176', addr: 'מועדון נגמלי הסמים',                         hood: 'שיכון ד' },
  { num: '177', addr: 'יצחק בן צבי 857',                           hood: 'שיכון ד' },
  { num: '178', addr: 'יצחק בן צבי 1068',                          hood: 'שיכון ד' },
  { num: '179', addr: 'ז\'בוטינסקי 28',                             hood: 'שיכון ד' },
  { num: '180', addr: 'בית ספר ענבלים',                             hood: 'שיכון ד' },
  { num: '181', addr: 'בית ספר מע"ש',                               hood: 'שיכון ד' },
  { num: '182', addr: 'בית ספר נעורים',                             hood: 'שיכון ד' },
  { num: '183', addr: 'תיכון בת מלך',                              hood: 'שיכון ד' },
  { num: '184', addr: 'בית כנסת אהבת חיים',                        hood: 'שיכון ד' },
  { num: '185', addr: 'מועדון נוער חב"ד',                           hood: 'שיכון ד' },
  { num: '186', addr: 'שרת 1060',                                  hood: 'שיכון ד' },
  { num: '187', addr: 'ז\'בוטינסקי 16',                             hood: 'שיכון ד' },
  { num: '188', addr: 'יצחק בן צבי 860',                           hood: 'שיכון ד' },
  { num: '189', addr: 'ויצמן 682',                                 hood: 'שיכון ד' },
  { num: '190', addr: 'נווה חן 155',                               hood: 'שיכון ד' },
  { num: '191', addr: 'נווה חן 142',                               hood: 'שיכון ד' },
  { num: '192', addr: 'נווה חן 170',                               hood: 'שיכון ד' },
  // מורדות
  { num: '201', addr: 'תמר 292',                                   hood: 'מורדות' },
  { num: '202', addr: 'תמר 291',                                   hood: 'מורדות' },
  { num: '203', addr: 'תמר 285',                                   hood: 'מורדות' },
  { num: '204', addr: 'תמר 272',                                   hood: 'מורדות' },
  { num: '205', addr: 'תמר 258',                                   hood: 'מורדות' },
  { num: '206', addr: 'שקד 295',                                   hood: 'מורדות' },
  { num: '207', addr: 'תמר 274',                                   hood: 'מורדות' },
  { num: '208', addr: 'חלמונית',                                   hood: 'מורדות' },
  { num: '209', addr: 'שיזף 338',                                  hood: 'מורדות' },
  { num: '210', addr: 'רותם 262',                                  hood: 'מורדות' },
  { num: '211', addr: 'לוטם 202',                                  hood: 'מורדות' },
  { num: '212', addr: 'רותם 263',                                  hood: 'מורדות' },
  { num: '213', addr: 'השיטה',                                     hood: 'מורדות' },
  { num: '214', addr: 'שקד 246',                                   hood: 'מורדות' },
  { num: '215', addr: 'חרצית 4',                                   hood: 'מורדות' },
  { num: '216', addr: 'דובדבן 402',                                hood: 'מורדות' },
  { num: '217', addr: 'דובדבן 402',                                hood: 'מורדות' },
  { num: '218', addr: 'ברנקו וייס',                                hood: 'מורדות' },
  { num: '219', addr: 'שקד 253',                                   hood: 'מורדות' },
  { num: '220', addr: 'שיזף 347',                                  hood: 'מורדות' },
];

// Tiberias bounding box
function inTiberiasBounds(lat, lon) {
  return lat >= 32.75 && lat <= 32.81 && lon >= 35.50 && lon <= 35.56;
}

function geocode(address) {
  const query = `${address}, טבריה, ישראל`;
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

  console.log(`Geocoding ${RAW_DATA.length} shelters in טבריה...`);
  const shelters = [];
  const failures = [];
  const outOfBounds = [];

  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.addr);

    if (!coords) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);
    } else if (!inTiberiasBounds(coords.lat, coords.lon)) {
      outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon });
      console.warn(`  [${i+1}/${RAW_DATA.length}] OUT OF BOUNDS: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    } else {
      shelters.push({
        id: `טבריה-${shelters.length + 1}`,
        lat: coords.lat,
        lon: coords.lon,
        name: `מקלט ${e.num}`,
        address: e.addr,
        city: 'טבריה',
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
  const outputPath = path.join(__dirname, 'tiberias-output.json');
  fs.writeFileSync(outputPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${outputPath}`);

  const dataPath = path.join(__dirname, '..', 'data', 'tiberias-shelters.json');
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
    failures.forEach(f => console.log(`  - מקלט ${f.num}: ${f.addr}`));
  }
  if (outOfBounds.length > 0) {
    console.log(`\nOut-of-bounds (excluded):`);
    outOfBounds.forEach(o => console.log(`  - מקלט ${o.num}: ${o.addr} -> (${o.lat}, ${o.lon})`));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
