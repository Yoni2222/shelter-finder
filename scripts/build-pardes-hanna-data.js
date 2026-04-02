'use strict';
/**
 * Build Pardes Hanna-Karkur (פרדס חנה-כרכור) shelters data.
 * Source: Municipality website - 62 public shelters.
 * Run: node scripts/build-pardes-hanna-data.js
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

const RAW_DATA = [
  { num: '1',  addr: 'תבור 15, אשכולות רסקו',                    geocodeAddr: 'תבור 15' },
  { num: '2',  addr: 'סמטת השיטה 4',                              geocodeAddr: 'סמטת השיטה 4' },
  { num: '3',  addr: 'יחזקאל 5, שכונת הדר/גאולה',                 geocodeAddr: 'יחזקאל 5' },
  { num: '4',  addr: 'הגאון 2, ליד בית 57',                       geocodeAddr: 'הגאון 2' },
  { num: '5',  addr: 'מלאכי פינת חשמונאים',                       geocodeAddr: 'מלאכי' },
  { num: '6',  addr: 'חבקוק 220, מרכז קליטה',                     geocodeAddr: 'חבקוק 220' },
  { num: '7',  addr: 'חבקוק 219, מרכז קליטה',                     geocodeAddr: 'חבקוק 219' },
  { num: '8',  addr: 'חבקוק פינת דרך למרחב 209',                  geocodeAddr: 'חבקוק 209' },
  { num: '9',  addr: 'חבקוק 203, מרכז קליטה',                     geocodeAddr: 'חבקוק 203' },
  { num: '10', addr: 'הציונות מאחורי חבקוק 205',                  geocodeAddr: 'הציונות' },
  { num: '11', addr: 'הציונות מאחורי חבקוק 200',                  geocodeAddr: 'הציונות' },
  { num: '12', addr: 'סמטת צבעוני, גאולה 192',                    geocodeAddr: 'גאולה 192' },
  { num: '13', addr: 'סמטת ירדן, גאולה 187',                      geocodeAddr: 'גאולה 187' },
  { num: '14', addr: 'התקומה 2, שב"ל 1',                          geocodeAddr: 'התקומה 2' },
  { num: '15', addr: 'ליד בית 202, שב"ל 2',                       geocodeAddr: 'התקומה' },
  { num: '16', addr: 'התקומה 6, שב"ל 3',                          geocodeAddr: 'התקומה 6' },
  { num: '17', addr: 'שובל פינת אחדות, שב"ל 4',                   geocodeAddr: 'שובל' },
  { num: '18', addr: 'בית 276, התקומה 10, שב"ל 5',                geocodeAddr: 'התקומה 10' },
  { num: '19', addr: 'בית 575, תקומה, שב"ל 6',                    geocodeAddr: 'התקומה' },
  { num: '20', addr: 'בית 588, שב"ל 7',                           geocodeAddr: 'שובל' },
  { num: '21', addr: 'בית 589, שב"ל 8',                           geocodeAddr: 'שובל' },
  { num: '22', addr: 'בית 594, שב"ל 9',                           geocodeAddr: 'שובל' },
  { num: '23', addr: 'אחווה ליד בית 550, שב"ל 10',                geocodeAddr: 'אחווה' },
  { num: '24', addr: 'התקומה 8א, שב"ל 11',                        geocodeAddr: 'התקומה 8' },
  { num: '25', addr: 'חברון, ליד מועדון צמרת',                    geocodeAddr: 'חברון' },
  { num: '26', addr: 'עציון 12',                                  geocodeAddr: 'עציון 12' },
  { num: '27', addr: 'רמב"ם 20, ליד ביה"כ נצח ישראל',             geocodeAddr: 'רמבם 20' },
  { num: '28', addr: 'מצדה פינת גוש חלב, ליד הפארק',              geocodeAddr: 'מצדה' },
  { num: '29', addr: 'המכבים פינת מודיעין',                        geocodeAddr: 'המכבים' },
  { num: '30', addr: 'מכבים פינת מצדה, ליד בי"ס חורב',            geocodeAddr: 'מצדה' },
  { num: '31', addr: 'סמטת מרחבים, בי"ס מרחבים',                  geocodeAddr: 'מרחבים' },
  { num: '32', addr: 'חשמונאים 43, נווה מרחב',                    geocodeAddr: 'חשמונאים 43' },
  { num: '33', addr: 'חסידה, ליד גן הזית, רמז',                   geocodeAddr: 'חסידה' },
  { num: '34', addr: 'זמיר פינת יונה, גן הציפורים, רמז',          geocodeAddr: 'זמיר' },
  { num: '35', addr: 'נחליאלי 12, ליד גן דקל, רמז',               geocodeAddr: 'נחליאלי 12' },
  { num: '36', addr: 'סנונית 2, רמז',                             geocodeAddr: 'סנונית 2' },
  { num: '37', addr: 'תמר, נווה אשר, ליד בית 10',                 geocodeAddr: 'תמר 10' },
  { num: '38', addr: 'קק"ל, נווה אשר, מול בית 13',                geocodeAddr: 'קרן קיימת לישראל 13' },
  { num: '39', addr: 'ההסתדרות, ליד גן וייל, מול בית 29',         geocodeAddr: 'ההסתדרות 29' },
  { num: '40', addr: 'שלום, בין בית 10 ל-14',                     geocodeAddr: 'שלום 10' },
  { num: '41', addr: 'הקנאים, ליד גן לילך',                       geocodeAddr: 'הקנאים' },
  { num: '42', addr: 'כוכב פינת העליה, ליד בית 7',                geocodeAddr: 'כוכב 7' },
  { num: '43', addr: 'המגינים 15',                                geocodeAddr: 'המגינים 15' },
  { num: '44', addr: 'הנחל מול בית 4',                            geocodeAddr: 'הנחל 4' },
  { num: '45', addr: 'יוסף קארו, ליד גן קנדי',                   geocodeAddr: 'יוסף קארו' },
  { num: '46', addr: 'ההגנה, בין בית 27 ל-29',                    geocodeAddr: 'ההגנה 27' },
  { num: '47', addr: 'פלמ"ח 25',                                  geocodeAddr: 'פלמח 25' },
  { num: '48', addr: 'חשמונאים פינת שבי ציון, ליד גן שקד',        geocodeAddr: 'חשמונאים' },
  { num: '49', addr: 'שבי ציון 12',                               geocodeAddr: 'שבי ציון 12' },
  { num: '50', addr: 'המייסדים 77, בי"ס ממלכתי כרכור',            geocodeAddr: 'המייסדים 77' },
  { num: '51', addr: 'שבזי, בי"ס מורשה',                          geocodeAddr: 'שבזי' },
  { num: '52', addr: 'דרך הבנים פינת הנדיב, בי"ס אלונים',         geocodeAddr: 'דרך הבנים' },
  { num: '53', addr: 'סמטת ארבל, ליד בי"ס שרת',                   geocodeAddr: 'סמטת ארבל' },
  { num: '54', addr: 'בניין המועצה, דרך הבנים 20',                geocodeAddr: 'דרך הבנים 20' },
  { num: '55', addr: 'חן 11, ליד מועדון הצופים',                   geocodeAddr: 'חן 11' },
  { num: '56', addr: 'דביר, מול בתים 1-2',                        geocodeAddr: 'דביר 1' },
  { num: '57', addr: 'זכריה, שכונת מוסקוביץ',                     geocodeAddr: 'זכריה' },
  { num: '58', addr: 'אדנים 11, שכונת הדר',                       geocodeAddr: 'אדנים 11' },
  { num: '59', addr: 'אדנים, שכונת הדר',                          geocodeAddr: 'אדנים' },
  { num: '60', addr: 'המסילה',                                    geocodeAddr: 'המסילה' },
  { num: '61', addr: 'כורש, ליד מגרש כדורסל',                     geocodeAddr: 'כורש' },
  { num: '62', addr: 'הימאים, מתחת למקווה',                       geocodeAddr: 'הימאים' },
];

function inPardesHannaBounds(lat, lon) {
  return lat >= 32.45 && lat <= 32.50 && lon >= 34.94 && lon <= 35.00;
}

function geocode(address) {
  const query = `${address}, פרדס חנה-כרכור, ישראל`;
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
            resolve({ lat: loc.lat, lon: loc.lng, addressEn: result.results[0].formatted_address || '' });
          } else if (result.status === 'OVER_QUERY_LIMIT') {
            reject(new Error('RATE_LIMITED'));
          } else { resolve(null); }
        } catch (e) { reject(new Error('PARSE_ERROR')); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geocodeWithRetry(address, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await geocode(address); }
    catch (e) {
      if (e.message === 'RATE_LIMITED' || e.message === 'PARSE_ERROR') {
        await sleep(2000 * (attempt + 1));
      } else throw e;
    }
  }
  return null;
}

async function main() {
  if (!GOOGLE_API_KEY) { console.error('ERROR: No Google API key.'); process.exit(1); }

  console.log(`Geocoding ${RAW_DATA.length} shelters in פרדס חנה-כרכור...`);
  const shelters = [], failures = [], outOfBounds = [];

  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.geocodeAddr);
    if (!coords) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);
    } else if (!inPardesHannaBounds(coords.lat, coords.lon)) {
      outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon });
      console.warn(`  [${i+1}/${RAW_DATA.length}] OUT OF BOUNDS: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    } else {
      shelters.push({
        id: `פרדס-חנה-${shelters.length + 1}`,
        lat: coords.lat, lon: coords.lon,
        name: `מקלט ${e.num}`, address: e.addr, city: 'פרדס חנה-כרכור',
        type: 'מקלט ציבורי', source: 'gov', category: 'public',
        addressEn: coords.addressEn || '',
      });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    }
    await sleep(200);
  }

  const dataPath = path.join(__dirname, '..', 'data', 'pardes-hanna-shelters.json');
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${dataPath}`);
  console.log(`\n=== STATS ===`);
  console.log(`Total: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${outOfBounds.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.num}: ${f.addr}`));
  if (outOfBounds.length) outOfBounds.forEach(o => console.log(`  OOB: ${o.num}: ${o.addr} -> (${o.lat}, ${o.lon})`));
}

main().catch(e => { console.error(e.message); process.exit(1); });
