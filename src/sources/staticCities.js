'use strict';

const path = require('path');
const haversine = require('../utils/haversine');

// ─────────────────────────────────────────────
// Static JSON city definitions
// Each entry: { file, city } where file is the JSON filename in data/
// ─────────────────────────────────────────────
const STATIC_CITY_DEFS = [
  { file: 'ashkelon-shelters.json',    city: 'אשקלון' },
  { file: 'ashdod-shelters.json',      city: 'אשדוד' },
  { file: 'bat-yam-shelters.json',     city: 'בת ים' },
  { file: 'beer-sheva-shelters.json',  city: 'באר שבע' },
  { file: 'bnei-brak-shelters.json',   city: 'בני ברק' },
  { file: 'dimona-shelters.json',      city: 'דימונה' },
  { file: 'eilat-shelters.json',       city: 'אילת' },
  { file: 'givatayim-shelters.json',   city: 'גבעתיים' },
  { file: 'haifa-shelters.json',       city: 'חיפה' },
  { file: 'herzliya-shelters.json',    city: 'הרצליה' },
  { file: 'holon-shelters.json',       city: 'חולון' },
  { file: 'jerusalem-shelters.json',   city: 'ירושלים' },
  { file: 'kfar-saba-shelters.json',   city: 'כפר סבא' },
  { file: 'kfar-yona-shelters.json',   city: 'כפר יונה' },
  { file: 'kiryat-ono-shelters.json',  city: 'קרית אונו' },
  { file: 'nahariya-shelters.json',    city: 'נהריה' },
  { file: 'nesher-shelters.json',      city: 'נשר' },
  { file: 'netanya-shelters.json',     city: 'נתניה' },
  { file: 'or-yehuda-shelters.json',   city: 'אור יהודה' },
  { file: 'petah-tikva-shelters.json', city: 'פתח תקווה' },
  { file: 'ramat-gan-shelters.json',   city: 'רמת גן' },
  { file: 'rehovot-shelters.json',     city: 'רחובות' },
  { file: 'rosh-haayin-shelters.json', city: 'ראש העין' },
  { file: 'tel-aviv-shelters.json',    city: 'תל אביב' },
  { file: 'yehud-shelters.json',       city: 'יהוד' },
  { file: 'modiin-illit-shelters.json', city: 'מודיעין עילית' },
  { file: 'modiin-maccabim-reut-shelters.json', city: 'מודיעין-מכבים-רעות' },
  { file: 'hadera-shelters.json',              city: 'חדרה' },
  { file: 'afula-shelters.json',              city: 'עפולה' },
  { file: 'kiryat-shmona-shelters.json',      city: 'קריית שמונה' },
  { file: 'atlit-shelters.json',              city: 'עתלית' },
  { file: 'beit-shemesh-shelters.json',        city: 'בית שמש' },
  { file: 'ramle-shelters.json',              city: 'רמלה' },
  { file: 'lod-shelters.json',               city: 'לוד' },
  { file: 'raanana-shelters.json',           city: 'רעננה' },
  { file: 'akko-shelters.json',             city: 'עכו' },
  { file: 'hod-hasharon-shelters.json',    city: 'הוד השרון' },
  { file: 'ramat-hasharon-shelters.json', city: 'רמת השרון' },
  { file: 'kiryat-ata-shelters.json',     city: 'קריית אתא' },
  { file: 'kiryat-yam-shelters.json',     city: 'קריית ים' },
  { file: 'kiryat-bialik-shelters.json',  city: 'קריית ביאליק' },
  { file: 'kiryat-motzkin-shelters.json', city: 'קריית מוצקין' },
  { file: 'kiryat-gat-shelters.json',    city: 'קריית גת' },
  { file: 'sderot-shelters.json',        city: 'שדרות' },
  { file: 'netivot-shelters.json',       city: 'נתיבות' },
  { file: 'yavne-shelters.json',         city: 'יבנה' },
  { file: 'karmiel-shelters.json',       city: 'כרמיאל' },
  { file: 'safed-shelters.json',         city: 'צפת' },
  { file: 'tiberias-shelters.json',      city: 'טבריה' },
  { file: 'nes-ziona-shelters.json',     city: 'נס ציונה' },
  { file: 'nof-hagalil-shelters.json',   city: 'נוף הגליל' },
  { file: 'yokneam-shelters.json',       city: 'יקנעם עילית' },
  { file: 'zichron-yaakov-shelters.json', city: 'זכרון יעקב' },
  { file: 'binyamina-shelters.json',     city: 'בנימינה-גבעת עדה' },
  { file: 'migdal-haemek-shelters.json', city: 'מגדל העמק' },
  { file: 'kiryat-malachi-shelters.json', city: 'קריית מלאכי' },
  { file: 'tirat-carmel-shelters.json',   city: 'טירת כרמל' },
  { file: 'ramat-yishai-shelters.json',   city: 'רמת ישי' },
  { file: 'maalot-tarshiha-shelters.json', city: 'מעלות-תרשיחא' },
  { file: 'arad-shelters.json',            city: 'ערד' },
  { file: 'ofakim-shelters.json',          city: 'אופקים' },
  { file: 'beer-yaakov-shelters.json',    city: 'באר יעקב' },
  { file: 'givat-shmuel-shelters.json',   city: 'גבעת שמואל' },
  { file: 'maale-adumim-shelters.json',   city: 'מעלה אדומים' },
  { file: 'or-akiva-shelters.json',       city: 'אור עקיבא' },
  { file: 'pardes-hanna-shelters.json',  city: 'פרדס חנה-כרכור' },
  { file: 'ganei-tikva-shelters.json',  city: 'גני תקווה' },
  { file: 'ariel-shelters.json',        city: 'אריאל' },
  { file: 'kfar-vradim-shelters.json',   city: 'כפר ורדים' },
  { file: 'metula-shelters.json',        city: 'מטולה' },
  { file: 'tivon-shelters.json',         city: 'קריית טבעון' },
  { file: 'mitzpe-ramon-shelters.json',  city: 'מצפה רמון' },
  { file: 'gedera-shelters.json',        city: 'גדרה' },
  { file: 'yeroham-shelters.json',      city: 'ירוחם' },
  { file: 'beit-dagan-shelters.json',  city: 'בית דגן' },
  { file: 'mazkeret-batya-shelters.json', city: 'מזכרת בתיה' },
  { file: 'savyon-shelters.json',          city: 'סביון' },
  { file: 'shlomi-shelters.json',          city: 'שלומי' },
  { file: 'kiryat-ekron-shelters.json',    city: 'קריית עקרון' },
  { file: 'katzrin-shelters.json',          city: 'קצרין' },
  { file: 'rosh-pinna-shelters.json',      city: 'ראש פינה' },
  { file: 'gan-yavne-shelters.json',      city: 'גן יבנה' },
]

// Load all static JSON files and build caches
const dataDir = path.join(__dirname, '..', '..', 'data');
const staticCaches = {};
const allStaticShelters = [];

for (const def of STATIC_CITY_DEFS) {
  const data = require(path.join(dataDir, def.file));
  staticCaches[def.file] = data;
  // Normalize generic names: if name = neighborhood/city/empty, use "מקלט - {address}"
    data.forEach(s => {
      const n = (s.name || '').trim();
      if (!n || n === s.neighborhood || n === s.city || n === def.city) {
        s.name = 'מקלט - ' + (s.address || '').split(',')[0];
      }
    });
    allStaticShelters.push(...data);
}

console.log(`[startup] Master shelter index: ${allStaticShelters.length} shelters from static JSON`);

// Factory: create a fetch function for a static city
function makeStaticFetcher(jsonFile) {
  const data = staticCaches[jsonFile];
  return function fetchStatic(lat, lon, radiusM) {
    return Promise.resolve(
      data.filter(s => haversine(lat, lon, s.lat, s.lon) * 1000 <= radiusM)
    );
  };
}

// Build fetcher map: { 'haifa-shelters.json': fetchFn, ... }
const staticFetchers = {};
for (const def of STATIC_CITY_DEFS) {
  staticFetchers[def.file] = makeStaticFetcher(def.file);
}

module.exports = {
  STATIC_CITY_DEFS,
  staticCaches,
  allStaticShelters,
  staticFetchers,
  makeStaticFetcher,
};
