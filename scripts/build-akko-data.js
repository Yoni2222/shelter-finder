'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = 'עכו';
const CITY_EN = 'Acre';

const SHELTERS = [
  ['לוחמי הגטאות', '39', 'שני אליהו'],
  ['דב גרונר', '4', 'שני אליהו'],
  ['הרצל', '19', 'שני אליהו'],
  ['גיבורי סיני', '29', 'שני אליהו'],
  ['גיבורי סיני', '25', 'שני אליהו'],
  ['גיבורי סיני', '30', 'שני אליהו'],
  ['גיבורי סיני', '32', 'שני אליהו'],
  ['יאנוש קורצ\'אק', '5', 'שני אליהו'],
  ['יאנוש קורצ\'אק', '11', 'שני אליהו'],
  ['יאנוש קורצ\'אק', '2', 'שני אליהו'],
  ['רמב"ם', '16', 'שני אליהו'],
  ['סר אייזיק', '4', 'שני אליהו'],
  ['דרך הארבעה', '45', 'שכונת וולפסון'],
  ['טרומפלדור', '32', 'שכונת וולפסון'],
  ['החרושת', '4', 'שכונת וולפסון'],
  ['האורן', '29', 'שכונת וולפסון'],
  ['האורן', '28', 'שכונת וולפסון'],
  ['רמז', '1', 'שכונת וולפסון'],
  ['היוצרים', '6', 'יהושפט'],
  ['קיבוץ גלויות', '4', 'יהושפט'],
  ['קיבוץ גלויות', '1', 'יהושפט'],
  ['עציון', '10', 'יהושפט'],
  ['יוסף כתראן', '4', 'יהושפט'],
  ['הנשר', '1', 'יהושפט'],
  ['קדושי קהיר', '16', 'יהושפט'],
  ['קדושי קהיר', '20', 'יהושפט'],
  ['אחד העם', '17', 'יהושפט'],
  ['בורוכוב', '16', 'יהושפט'],
  ['בורוכוב', '17', 'יהושפט'],
  ['בבל', '32', 'יהושפט'],
  ['קדושי השואה', '3', 'יהושפט'],
  ['בבל', '11', 'יהושפט'],
  ['יצחק שדה', '2', 'יהושפט'],
  ['יקותיאל אדם', '4', 'יהושפט'],
  ['חיים לסקוב', '5', 'יהושפט'],
  ['חיים לסקוב', '14', 'יהושפט'],
  ['הנדיב', '1', 'יהושפט'],
  ['בילו', '16', 'יהושפט'],
  ['הס', '5', 'יהושפט'],
  ['פלמ"ח', '1', 'יהושפט'],
  ['הברק', '1', 'יהושפט'],
  ['החרוב', '2', 'יהושפט'],
  ['הגפן', '1', 'שביל הגן'],
  ['העצמאות', '19', ''],
  ['שביל היערה', '5', ''],
  ['שלמה בן יוסף', '16', ''],
  ['קדושי קהיר', '18', ''],
];

const EN_FALLBACK = {
  'לוחמי הגטאות': 'Lochamei HaGetaot',
  'דב גרונר': 'Dov Gruner',
  'הרצל': 'Herzl',
  'גיבורי סיני': 'Gibborei Sinai',
  'יאנוש קורצ\'אק': 'Janusz Korczak',
  'רמב"ם': 'Rambam',
  'סר אייזיק': 'Sir Isaac',
  'דרך הארבעה': 'Derekh HaArba',
  'טרומפלדור': 'Trumpeldor',
  'החרושת': 'HaCharoshet',
  'האורן': 'HaOren',
  'רמז': 'Remez',
  'היוצרים': 'HaYotzrim',
  'קיבוץ גלויות': 'Kibbutz Galuyot',
  'עציון': 'Etzion',
  'יוסף כתראן': 'Yosef Katran',
  'הנשר': 'HaNesher',
  'קדושי קהיר': 'Kedoshei Kahir',
  'אחד העם': 'Ahad HaAm',
  'בורוכוב': 'Borochov',
  'בבל': 'Bavel',
  'קדושי השואה': 'Kedoshei HaShoah',
  'יצחק שדה': 'Yitzhak Sade',
  'יקותיאל אדם': 'Yekutiel Adam',
  'חיים לסקוב': 'Haim Laskov',
  'הנדיב': 'HaNadiv',
  'בילו': 'Bilu',
  'הס': 'Hess',
  'פלמ"ח': 'Palmach',
  'הברק': 'HaBarak',
  'החרוב': 'HaCharuv',
  'הגפן': 'HaGefen',
  'העצמאות': 'HaAtzmaut',
  'שביל היערה': 'Shvil HaYaara',
  'שלמה בן יוסף': 'Shlomo Ben Yosef',
};

// Akko bounding box
const BOUNDS = { latMin: 32.91, latMax: 32.95, lonMin: 35.06, lonMax: 35.10 };

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
  const addrLocal = `${street} ${houseNum}`;
  const fullAddr = `${addrLocal}, ${CITY}, ישראל`;

  let geo = await geocode(fullAddr);
  if (geo) return { geo, addrLocal };

  const enStreet = EN_FALLBACK[street];
  if (enStreet) {
    const enAddr = `${enStreet} ${houseNum}, ${CITY_EN}, Israel`;
    geo = await geocode(enAddr);
    if (geo) return { geo, addrLocal };
  }

  return { geo: null, addrLocal };
}

async function main() {
  const shelters = [];
  let success = 0, fail = 0;

  for (let i = 0; i < SHELTERS.length; i++) {
    const [street, houseNum, neighborhood] = SHELTERS[i];
    const { geo, addrLocal } = await geocodeWithFallback(street, houseNum);
    if (geo) {
      shelters.push({
        id: `akko_${i + 1}`,
        lat: geo.lat, lon: geo.lon,
        name: `מקלט - ${street} ${houseNum}`,
        address: `${street} ${houseNum}, ${CITY}`,
        city: CITY, capacity: '', type: 'מקלט ציבורי',
        source: 'gov', category: 'public', addressEn: geo.formatted,
        neighborhood,
      });
      success++;
      console.log(`OK ${i + 1}: ${addrLocal} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`FAIL ${i + 1}: ${addrLocal}`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nTotal: ${success} geocoded, ${fail} failed out of ${SHELTERS.length}`);

  const outPath = path.join(__dirname, '..', 'data', 'akko-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
