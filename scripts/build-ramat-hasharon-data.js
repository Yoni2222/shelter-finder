require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY'); process.exit(1); }

const BOUNDS = { latMin: 32.12, latMax: 32.17, lonMin: 34.82, lonMax: 34.88 };

function inBounds(lat, lon) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax;
}

// All 113 shelter entries from Ramat HaSharon municipality
// Format: [id, street, number, neighborhood, category]
const SHELTERS = [
  ['rs_301', 'נהרדעא', '24', '', 'public'],
  ['rs_302', 'עזרא', '54', '', 'public'],
  ['rs_303', 'עזרא', '22', 'מורשה', 'public'],
  ['rs_304a', 'עוזיה', '', 'מורשה', 'public'],
  ['rs_304b', 'עוזיה', '', 'מורשה', 'public'],
  ['rs_304c', 'עוזיה', '', 'מורשה', 'public'],
  ['rs_306', 'יהודה הנשיא', '2', '', 'public'],
  ['rs_308', 'בר כוכבא', '', '', 'public'],
  ['rs_309', 'שמואל הנגיד', '46', '', 'school'],
  ['rs_310', 'שבטי ישראל', '19', 'נווה רסקו', 'public'],
  ['rs_312', 'רקפת', '10', '', 'public'],
  ['rs_313', 'אילת', '44', '', 'public'],
  ['rs_315', 'בית גוברין', '7', 'מורשה', 'public'],
  ['rs_317', 'לכיש', '2', '', 'public'],
  ['rs_318', 'שבטי ישראל', '80', 'מורשה', 'public'],
  ['rs_319', 'הגפן', '47', '', 'public'],
  ['rs_320', 'בית גוברין', '2', '', 'public'],
  ['rs_321', 'התומר', '57', '', 'public'],
  ['rs_322', 'התומר', '25', '', 'public'],
  ['rs_323', 'בית השואבה', '', 'מורשה', 'school'],
  ['rs_324', 'הרב קוק', '25', '', 'public'],
  ['rs_325', 'הזית', '8', '', 'public'],
  ['rs_326', 'תחכמוני', '3', 'נוה מגן', 'public'],
  ['rs_327', 'יצחק שדה', '4', 'נוה מגן', 'public'],
  ['rs_328', 'יצחק שדה', '4', 'נוה מגן', 'public'],
  ['rs_329', 'המלכים', '4', '', 'public'],
  ['rs_330', 'ריינס', '11', '', 'public'],
  ['rs_331', 'ריינס', '17', '', 'public'],
  ['rs_332', 'רמז', '8', 'נוה מגן', 'school'],
  ['rs_333', 'החרוב', '19', 'נוה מגן', 'school'],
  ['rs_334', 'החרוב', '19', 'נוה מגן', 'school'],
  ['rs_335', 'החרוב', '19', 'נוה מגן', 'public'],
  ['rs_336', 'יהושע טהון', '5', 'נוה מגן', 'school'],
  ['rs_337', 'יהושע טהון', '5', 'נוה מגן', 'school'],
  ['rs_338', 'יהושע טהון', '5', '', 'public'],
  ['rs_339', 'הדקל', '18', '', 'public'],
  ['rs_340', 'תרפ"ד', '45', 'נווה רסקו', 'school'],
  ['rs_341', 'ורד', '', 'נווה רסקו', 'public'],
  ['rs_342', 'חצב', '', 'נווה רסקו', 'public'],
  ['rs_343', 'צלף', '', 'נווה רסקו', 'public'],
  ['rs_344', 'המאבק', '9', 'נווה רסקו', 'public'],
  ['rs_345', 'דליה', '11', 'נווה רסקו', 'public'],
  ['rs_346', 'דליה', '23', 'נווה רסקו', 'public'],
  ['rs_347', 'סמדר', '', 'נווה רסקו', 'public'],
  ['rs_348', 'הטלים', '', 'הכפר הירוק', 'public'],
  ['rs_349', 'אוסישקין', '7', 'הדר', 'public'],
  ['rs_351', 'אוסישקין', '65', 'הדר', 'public'],
  ['rs_352', 'אוסישקין', '65', 'הדר', 'public'],
  ['rs_353', 'הקישון', '6', 'גולן', 'public'],
  ['rs_354', 'ארנון', '17', 'גולן', 'public'],
  ['rs_355', 'הבנים', '46', 'גולן', 'school'],
  ['rs_356', 'המרי', '8', 'גולן', 'public'],
  ['rs_357', 'הבנים', '46', 'גולן', 'school'],
  ['rs_358', 'המחתרת', '2', 'אלון', 'public'],
  ['rs_360', 'אשל אברהם', '3', 'קרית יערים', 'public'],
  ['rs_361', "ז' בחשוון", '8', 'קרית יערים', 'public'],
  ['rs_362', 'קהילת וילנא', '', 'קרית יערים', 'public'],
  ['rs_363', 'השחף', '5', 'נוה רום', 'public'],
  ['rs_364', 'היסעור', '8', 'נוה רום', 'public'],
  ['rs_365', 'חוחית', '19', 'נוה רום', 'public'],
  ['rs_366', 'הזרזיר', '4', 'נוה רום', 'public'],
  ['rs_367', 'סנונית', '3', 'נוה רום', 'public'],
  ['rs_368', 'שבטי ישראל', '42', 'נוה מגן', 'public'],
  ['rs_369', 'יצחק אלחנן', '13', 'קרית יערים', 'school'],
  ['rs_370', 'סולד', '27', 'הדר', 'school'],
  ['rs_371', 'ארלוזורוב', '20', 'מורשה', 'public'],
  ['rs_372', 'השח"ל', '34', 'מורשה', 'public'],
  ['rs_373', 'בית הלל', '8', 'מורשה', 'public'],
  ['rs_374', 'הגפן', '170', 'מורשה', 'public'],
  ['rs_375', 'הזית', '56', 'נוה מגן', 'public'],
  ['rs_376', 'למרחב', '31', 'גולן', 'public'],
  ['rs_377', 'שבטי ישראל', '', 'נוה מגן', 'public'],
  ['rs_379', 'ויצמן', '20', 'קרית יערים', 'public'],
  ['rs_380a', 'הנביאים', '', 'מורשה', 'public'],
  ['rs_380b', 'הנביאים', '', 'מורשה', 'public'],
  ['rs_384', 'קריית הצעירים', '', '', 'public'],
  ['rs_386', 'יהודה הנשיא', '61', 'מורשה', 'public'],
  ['rs_387', 'התומר', '20', 'נוה מגן', 'public'],
  ['rs_390', 'אילת', '8', 'מורשה', 'public'],
  ['rs_391', 'בית הלל', '2', 'מורשה', 'public'],
  ['rs_392', 'שבי ציון', '18', 'מורשה', 'public'],
  ['rs_393', 'הנביאים', '100', 'מורשה', 'public'],
  ['rs_395', 'השופטים', '32', 'הדר', 'school'],
  ['rs_396', 'סוקולוב', '52', 'גולן', 'public'],
  ['rs_397', 'ריינס', '', 'מורשה', 'public'],
  ['rs_398', 'אוסישקין', '101', 'אלון', 'school'],
  ['rs_399', 'אוסישקין', '101', 'אלון', 'school'],
  ['rs_401', 'פארק הנצח', '', '', 'public'],
  ['rs_402', 'פארק הנצח', '', '', 'public'],
  ['rs_403', 'גינת הקוצר', '', '', 'public'],
  ['rs_404', 'גינת החבלים', '', 'נווה גן', 'public'],
  ['rs_405', 'דרך דודו דותן', '', '', 'public'],
  ['rs_406', 'הנוער', '1', '', 'public'],
  ['rs_407', 'החרוב', '', '', 'public'],
  ['rs_408', 'יגאל אלון', '', '', 'public'],
  ['rs_409', 'העבודה', '4', '', 'public'],
  ['rs_410', 'הטבק', '16', '', 'public'],
  ['rs_411', 'ביאליק', '41', '', 'parking'],
  ['rs_412', 'ויצמן', '28', '', 'public'],
  ['rs_413', "ז'בוטינסקי", '57', '', 'public'],
  // Page 2: Ilai neighborhood + migoniyot
  ['rs_414', 'שביל השדות', '', '', 'public'],
  ['rs_415', 'שביל השדות', '', '', 'public'],
  ['rs_416', 'שבי ציון', '103', 'עילי', 'public'],
  ['rs_417', 'שבטי ישראל', '102', 'עילי', 'public'],
  ['rs_418', 'מוריה', '28', 'עילי', 'public'],
  ['rs_419', 'בן גוריון', '', 'עילי', 'public'],
  ['rs_420', 'הנביאים', '53', 'עילי', 'public'],
  ['rs_421', 'השרף', '', 'עילי', 'public'],
  ['rs_422', 'חשמונאים', '', 'עילי', 'public'],
  ['rs_423', 'חשמונאים', '', 'עילי', 'public'],
  ['rs_424', 'הראשונים', '', 'עילי', 'public'],
  ['rs_425', 'השרף', '', 'עילי', 'public'],
  ['rs_yael', 'העבודה', '13', '', 'school'],
];

// English fallback translations
const EN_FALLBACK = {
  'נהרדעא': 'Nehardea',
  'עזרא': 'Ezra',
  'עוזיה': 'Uziya',
  'יהודה הנשיא': 'Yehuda HaNasi',
  'בר כוכבא': 'Bar Kochba',
  'שמואל הנגיד': 'Shmuel HaNagid',
  'שבטי ישראל': 'Shivtei Israel',
  'רקפת': 'Rakefet',
  'אילת': 'Eilat',
  'בית גוברין': 'Beit Guvrin',
  'לכיש': 'Lachish',
  'הגפן': 'HaGefen',
  'התומר': 'HaTomer',
  'בית השואבה': 'Beit HaShoeva',
  'הרב קוק': 'HaRav Kook',
  'הזית': 'HaZayit',
  'תחכמוני': 'Tachkemoni',
  'יצחק שדה': 'Yitzhak Sade',
  'המלכים': 'HaMelachim',
  'ריינס': 'Reines',
  'רמז': 'Remez',
  'החרוב': 'HaCharuv',
  'יהושע טהון': 'Yehoshua Tahon',
  'הדקל': 'HaDekel',
  'תרפ"ד': 'TaRPaD',
  'ורד': 'Vered',
  'חצב': 'Chatzav',
  'צלף': 'Tzalaf',
  'המאבק': 'HaMaavak',
  'דליה': 'Dalia',
  'סמדר': 'Smadar',
  'הטלים': 'HaTalim',
  'אוסישקין': 'Ussishkin',
  'הקישון': 'HaKishon',
  'ארנון': 'Arnon',
  'הבנים': 'HaBanim',
  'המרי': 'HaMeri',
  'המחתרת': 'HaMachteret',
  'אשל אברהם': 'Eshel Avraham',
  "ז' בחשוון": 'Zayin BeCheshvan',
  'קהילת וילנא': 'Kehilat Vilna',
  'השחף': 'HaShachaf',
  'היסעור': 'HaYisor',
  'חוחית': 'Chochit',
  'הזרזיר': 'HaZarzir',
  'סנונית': 'Snunit',
  'יצחק אלחנן': 'Yitzhak Elchanan',
  'סולד': 'Szold',
  'ארלוזורוב': 'Arlozorov',
  'השח"ל': 'HaShahal',
  'בית הלל': 'Beit Hillel',
  'למרחב': 'LaMerhav',
  'ויצמן': 'Weizmann',
  'הנביאים': 'HaNeviim',
  'קריית הצעירים': 'Kiryat HaTzeirim',
  'השופטים': 'HaShoftim',
  'סוקולוב': 'Sokolov',
  'פארק הנצח': 'Netzach Park',
  'גינת הקוצר': 'HaKotzer Garden',
  'גינת החבלים': 'HaChavalim Garden',
  'דרך דודו דותן': 'Derech Dudu Dotan',
  'הנוער': 'HaNoar',
  'יגאל אלון': 'Yigal Alon',
  'העבודה': 'HaAvoda',
  'הטבק': 'HaTabak',
  'ביאליק': 'Bialik',
  "ז'בוטינסקי": 'Jabotinsky',
  'שביל השדות': 'Shvil HaSadot',
  'שבי ציון': 'Shvei Tzion',
  'מוריה': 'Moriah',
  'בן גוריון': 'Ben Gurion',
  'השרף': 'HaSaraf',
  'חשמונאים': 'Hashmonaim',
  'הראשונים': 'HaRishonim',
};

function buildAddress(street, num) {
  const addr = num ? `${street} ${num}` : street;
  return `${addr}, רמת השרון`;
}

function buildEnAddress(street, num) {
  const en = EN_FALLBACK[street];
  if (!en) return null;
  const addr = num ? `${en} ${num}` : en;
  return `${addr}, Ramat HaSharon, Israel`;
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address };
  }
  return null;
}

async function reverseGeocode(lat, lon) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&language=en&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results.length > 0) {
    return data.results[0].formatted_address;
  }
  return '';
}

async function main() {
  console.log(`Processing ${SHELTERS.length} Ramat HaSharon shelters...`);

  // Build unique address keys
  const addrMap = new Map();
  for (const [id, street, num] of SHELTERS) {
    const key = `${street}|${num}`;
    if (!addrMap.has(key)) addrMap.set(key, { street, num });
  }
  console.log(`${addrMap.size} unique addresses to geocode`);

  const geoResults = new Map();
  let success = 0, failed = 0;

  for (const [key, { street, num }] of addrMap) {
    const heAddr = buildAddress(street, num);
    await new Promise(r => setTimeout(r, 50));

    let result = await geocode(heAddr);
    let usedEn = false;

    if (result && !inBounds(result.lat, result.lon)) {
      console.log(`  OUT OF BOUNDS (HE): ${heAddr} -> ${result.lat},${result.lon}`);
      result = null;
    }

    if (!result) {
      const enAddr = buildEnAddress(street, num);
      if (enAddr) {
        await new Promise(r => setTimeout(r, 50));
        result = await geocode(enAddr);
        usedEn = true;
        if (result && !inBounds(result.lat, result.lon)) {
          console.log(`  OUT OF BOUNDS (EN): ${enAddr} -> ${result.lat},${result.lon}`);
          result = null;
        }
      }
    }

    if (result) {
      await new Promise(r => setTimeout(r, 50));
      const addressEn = await reverseGeocode(result.lat, result.lon);
      geoResults.set(key, { lat: result.lat, lon: result.lon, addressEn });
      success++;
      console.log(`  OK${usedEn ? ' (EN)' : ''}: ${heAddr} -> ${result.lat.toFixed(5)},${result.lon.toFixed(5)}`);
    } else {
      failed++;
      console.log(`  FAILED: ${heAddr}`);
    }
  }

  console.log(`\nGeocoding done: ${success} success, ${failed} failed out of ${addrMap.size} unique addresses`);

  // Build shelter JSON
  const shelters = [];
  for (const [id, street, num, neighborhood, category] of SHELTERS) {
    const key = `${street}|${num}`;
    const geo = geoResults.get(key);
    if (!geo) continue;

    const name = num ? `${street} ${num}` : street;
    const address = num ? `${street} ${num}, רמת השרון` : `${street}, רמת השרון`;

    const s = {
      id,
      lat: geo.lat,
      lon: geo.lon,
      name: `מקלט ${name}`,
      address,
      city: 'רמת השרון',
      capacity: null,
      type: 'bomb_shelter',
      source: 'gov',
      category,
      addressEn: geo.addressEn,
    };
    if (neighborhood) s.neighborhood = neighborhood;
    shelters.push(s);
  }

  const outPath = path.join(__dirname, '..', 'data', 'ramat-hasharon-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nWrote ${shelters.length} shelters to ${outPath}`);
}

main().catch(console.error);
