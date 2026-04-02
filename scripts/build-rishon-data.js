'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = 'AIzaSyB6rgqJ418JtjyhYGzamDqpFt_ugYBMD_g';

const RAW_DATA = [
  // -- Public shelters --
  // שיכוני המזרח
  { addr:'מאיר אבנר 22',       hood:'שיכוני המזרח', category:'public' },
  { addr:'ישעיהו הנביא 16',    hood:'שיכוני המזרח', category:'public' },
  { addr:'עזרא 39',            hood:'שיכוני המזרח', category:'public' },
  { addr:'רד"ק 46',            hood:'שיכוני המזרח', category:'public' },
  { addr:'זרובבל 1',           hood:'שיכוני המזרח', category:'public' },
  { addr:'אסירי ציון 7',       hood:'שיכוני המזרח', category:'public' },
  { addr:'מורדי הגטאות 56',    hood:'שיכוני המזרח', category:'public' },
  { addr:'הרקפת 45',           hood:'שיכוני המזרח', category:'public' },
  { addr:'החבצלת 25',          hood:'שיכוני המזרח', category:'public' },
  { addr:'החצב 16',            hood:'שיכוני המזרח', category:'public' },
  { addr:'החרוב',              hood:'שיכוני המזרח', category:'public' },
  // רביבים
  { addr:'כיכר מודיעין 10',    hood:'רביבים', category:'public' },
  { addr:'גוש עציון 30',       hood:'רביבים', category:'public' },
  { addr:'אלקלעי 28',          hood:'רביבים', category:'public' },
  // ראשונים
  { addr:'סמילנסקי 34',        hood:'ראשונים', category:'public' },
  // רמת אליהו
  { addr:'מלכי ישראל 6',       hood:'רמת אליהו', category:'public' },
  { addr:'שלמה המלך 10',       hood:'רמת אליהו', category:'public' },
  { addr:'שלום אש 8',          hood:'רמת אליהו', category:'public' },
  { addr:'שלום אש 8',          hood:'רמת אליהו', category:'public' },
  { addr:'נתן שלמה 15',        hood:'רמת אליהו', category:'public' },
  { addr:'זלמן שניאור 18',     hood:'רמת אליהו', category:'public' },
  { addr:'התדהר 2',            hood:'רמת אליהו', category:'public' },
  { addr:'חיים אריאב 4',       hood:'רמת אליהו', category:'public' },
  { addr:'הכנסת 1',            hood:'רמת אליהו', category:'public' },
  { addr:'שי עגנון 1',         hood:'רמת אליהו', category:'public' },
  { addr:'גולינקין 8',         hood:'רמת אליהו', category:'public' },
  { addr:'גולינקין 8',         hood:'רמת אליהו', category:'public' },
  { addr:'יעקב כהן 28',        hood:'רמת אליהו', category:'public' },
  { addr:'אבו חצירא 11',       hood:'רמת אליהו', category:'public' },
  { addr:'ספינת השלושה 14',    hood:'רמת אליהו', category:'public' },
  { addr:'אנילביץ 20',         hood:'רמת אליהו', category:'public' },
  { addr:'אנילביץ 20',         hood:'רמת אליהו', category:'public' },
  // נחלת יהודה
  { addr:'האגס 2',             hood:'נחלת יהודה', category:'public' },
  { addr:'התמר 2',             hood:'נחלת יהודה', category:'public' },
  { addr:'אלי כהן 4',          hood:'נחלת יהודה', category:'public' },
  { addr:'הבנים 13',           hood:'נחלת יהודה', category:'public' },
  { addr:'השניים 17',          hood:'נחלת יהודה', category:'public' },
  // כפר אריה
  { addr:'הר סיני',            hood:'כפר אריה', category:'public' },

  // -- School shelters --
  { addr:'חנה ומיכאל לוין 14',  hood:'', category:'school', schoolName:'אופקים' },
  { addr:'האחים סולימן 2',      hood:'', category:'school', schoolName:'אורנים' },
  { addr:'הבריגדה 13',          hood:'', category:'school', schoolName:'אחרון הבילויים' },
  { addr:'קידוש השם 11',        hood:'', category:'school', schoolName:'אלונים' },
  { addr:'האגס 4',              hood:'נחלת יהודה', category:'school', schoolName:'אליאב' },
  { addr:'דרובין 37',           hood:'', category:'school', schoolName:'אשכולות' },
  { addr:'כצנלסון 26',          hood:'', category:'school', schoolName:'בארי' },
  { addr:'תמר אבן 11',          hood:'', category:'school', schoolName:'הדרים' },
  { addr:'אבא הלל סילבר 22',   hood:'', category:'school', schoolName:'ויתקין' },
  { addr:'חיל צנחנים 5',        hood:'', category:'school', schoolName:'חופית' },
  { addr:'גוש עציון 23',        hood:'רביבים', category:'school', schoolName:'חטיבת מיכה רייסר' },
  { addr:'נגבה 33',             hood:'', category:'school', schoolName:'חטיבת גנים מקיף ט' },
  { addr:'צמח 7',               hood:'', category:'school', schoolName:'יסוד המעלה' },
  { addr:'האורנים',             hood:'', category:'school', schoolName:'יפה נוף' },
  { addr:'ירמיהו הנביא 11',    hood:'', category:'school', schoolName:'ישורון' },
  { addr:'הרברט סמואל 15',     hood:'', category:'school', schoolName:'עדיני' },
  { addr:'ברניצקי 29',          hood:'', category:'school', schoolName:'עין הקורא' },
  { addr:'אברבנאל 30',          hood:'', category:'school', schoolName:'רוזן' },
  { addr:'החצב 22',             hood:'', category:'school', schoolName:'רמז' },
  { addr:'החלמונית 6',          hood:'', category:'school', schoolName:'רננים' },
  { addr:'ראובן ובת שבע 4',    hood:'', category:'school', schoolName:'רעות' },
  { addr:'רבי עקיבא 27',        hood:'', category:'school', schoolName:'רקפות' },
  { addr:'שינקין 18',           hood:'', category:'school', schoolName:'שלמון' },
  { addr:'סטפן וייז 13',        hood:'', category:'school', schoolName:'תרבות' },
];

const CITY = 'ראשון לציון';

// Rishon LeZion bounding box (approx)
function inBounds(lat, lon) { return lat >= 31.93 && lat <= 32.01 && lon >= 34.73 && lon <= 34.82; }

function geocode(address) {
  const query = `${address}, ${CITY}, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          if (r.status === 'OK' && r.results.length > 0) {
            const l = r.results[0].geometry.location;
            resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' });
          } else if (r.status === 'OVER_QUERY_LIMIT') {
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

async function geocodeRetry(addr, retries = 3) {
  for (let a = 0; a < retries; a++) {
    try { return await geocode(addr); }
    catch (e) {
      if (e.message === 'RATE_LIMITED' || e.message === 'PARSE_ERROR') await sleep(2000 * (a + 1));
      else throw e;
    }
  }
  return null;
}

async function main() {
  console.log(`Geocoding ${RAW_DATA.length} shelters in ${CITY}...`);
  const shelters = [], failures = [], oob = [];

  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const c = await geocodeRetry(e.addr);
    if (!c) {
      failures.push(e);
      console.warn(`  [${i + 1}/${RAW_DATA.length}] FAIL: ${e.addr}`);
    } else if (!inBounds(c.lat, c.lon)) {
      oob.push({ ...e, ...c });
      console.warn(`  [${i + 1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);
    } else {
      const name = e.category === 'school'
        ? `מקלט בי"ס ${e.schoolName}`
        : `מקלט ציבורי - ${e.addr}`;
      shelters.push({
        id: `ראשון-לציון-${shelters.length + 1}`,
        lat: c.lat, lon: c.lon,
        name,
        address: e.addr,
        city: CITY,
        neighborhood: e.hood || '',
        type: e.category === 'school' ? 'מקלט בית ספר' : 'מקלט ציבורי',
        source: 'municipality',
        category: e.category,
        addressEn: c.addressEn || ''
      });
      console.log(`  [${i + 1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);
    }
    await sleep(200);
  }

  // Add OOB shelters (likely valid)
  for (const o of oob) {
    const name = o.category === 'school'
      ? `מקלט בי"ס ${o.schoolName}`
      : `מקלט ציבורי - ${o.addr}`;
    shelters.push({
      id: `ראשון-לציון-${shelters.length + 1}`,
      lat: o.lat, lon: o.lon,
      name,
      address: o.addr,
      city: CITY,
      neighborhood: o.hood || '',
      type: o.category === 'school' ? 'מקלט בית ספר' : 'מקלט ציבורי',
      source: 'municipality',
      category: o.category,
      addressEn: ''
    });
  }

  const p = path.join(__dirname, '..', 'data', 'rishon-lezion-shelters.json');
  fs.writeFileSync(p, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.addr}`));
}

main().catch(e => { console.error(e.message); process.exit(1); });
