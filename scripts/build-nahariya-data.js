'use strict';
/**
 * Build Nahariya shelters data.
 * Source: https://www.nahariya.muni.il/913/
 * The page contains 163 shelters in an HTML table with address data only (no coordinates).
 * This script geocodes each address via Google Geocoding API then saves as JSON.
 *
 * Run: node scripts/build-nahariya-data.js
 */

const fetch = require('node-fetch');
const fs = require('fs'), path = require('path');

// All 163 shelters extracted from the Nahariya municipality page
// Format: [id, address, type, district, dualPurpose]
// type: 'underground' | 'above' | 'accessible' | 'school'
const RAW_SHELTERS = [
  // District 3
  [210, 'שלמה המלך 17 נהריה', 'underground', 3, true],
  [211, 'יפה נוף 16 נהריה', 'underground', 3, false],
  [212, 'שלמה המלך 6 נהריה', 'underground', 3, false],
  [213, 'יפה נוף 1 נהריה', 'underground', 3, false],
  [219, 'נחמיה 16 נהריה', 'underground', 3, true],
  [220, 'יפה נוף 21 נהריה', 'underground', 3, false],
  [221, 'יפה נוף 29 נהריה', 'underground', 3, false],
  [225, 'יפה נוף 1 נהריה', 'underground', 3, true],
  [226, 'יפה נוף 42 נהריה', 'underground', 3, true],
  [227, 'שביל יהונתן 1 נהריה', 'underground', 3, false],
  [228, 'ירושלים 25 נהריה', 'underground', 3, false],
  [229, 'יפה נוף 16 נהריה', 'underground', 3, false],
  [230, 'שלמה המלך 30 נהריה', 'underground', 3, false],
  [231, 'שאול המלך 40 נהריה', 'underground', 3, false],
  [232, 'ירושלים 12 נהריה', 'underground', 3, false],
  [233, 'עזרא 27 נהריה', 'underground', 3, false],
  [234, 'שאול המלך 2 נהריה', 'underground', 3, false],
  [235, 'שלמה המלך 12 נהריה', 'underground', 3, false],
  [236, 'דוד המלך 7 נהריה', 'underground', 3, false],
  [237, 'אפריים שריר 4 נהריה', 'underground', 3, false],
  [238, 'אפרים שריר 18 נהריה', 'underground', 3, false],
  [239, 'אפרים שריר 24 נהריה', 'underground', 3, false],
  [240, 'אפרים שריר 32 נהריה', 'underground', 3, false],
  [241, 'יפה נוף 43 נהריה', 'underground', 3, false],
  [242, 'יפה נוף 32 נהריה', 'underground', 3, false],
  [243, 'עזרא 23 נהריה', 'underground', 3, false],
  [244, 'יפה נוף 16 נהריה', 'accessible', 3, false],
  // District 2
  [300, 'אשכול 24 נהריה', 'underground', 2, false],
  [301, 'רבי עקיבא 1 נהריה', 'underground', 2, false],
  [302, 'קיבוץ גלויות 47 נהריה', 'underground', 2, true],
  [303, 'אביר יעקב 31 נהריה', 'underground', 2, true],
  [304, 'השרון 96 נהריה', 'underground', 2, false],
  [309, 'הגלעד 7 נהריה', 'accessible', 2, false],
  [314, 'דרך יחיעם נהריה', 'underground', 2, false],
  [315, 'אביר יעקב 11 נהריה', 'underground', 2, false],
  [317, 'חנה סנש נהריה', 'underground', 2, false],
  [318, 'וייסבורג 7 נהריה', 'underground', 2, false],
  [319, 'עמק יזרעאל 10 נהריה', 'underground', 2, false],
  [320, 'השיירה 2 נהריה', 'underground', 2, true],
  [367, 'בן צבי 23 נהריה', 'underground', 2, true],
  [368, 'חנה סנש 13 נהריה', 'underground', 2, true],
  [369, 'קיבוץ גלויות 50 נהריה', 'underground', 2, false],
  [370, 'הזיתים 9 נהריה', 'underground', 2, false],
  [372, 'הנגב 2 נהריה', 'underground', 2, true],
  [373, 'השרון 11 נהריה', 'underground', 2, false],
  [374, 'הרב מימון נהריה', 'underground', 2, false],
  [375, 'קיבוץ גלויות 54 נהריה', 'underground', 2, false],
  [376, 'השיירה 18 נהריה', 'underground', 2, false],
  [377, 'רבי עקיבא 5 נהריה', 'underground', 2, false],
  [378, 'שביל הלל 3 נהריה', 'underground', 2, false],
  [379, 'השרון 19 נהריה', 'underground', 2, false],
  [380, 'דרך סטרומה 3 נהריה', 'underground', 2, true],
  [381, 'וייסבורג 9 נהריה', 'underground', 2, false],
  [382, 'קיבוץ גלויות 59 נהריה', 'underground', 2, false],
  [383, 'חנה סנש 7 נהריה', 'underground', 2, false],
  [384, 'יחיעם 1 נהריה', 'underground', 2, false],
  [385, 'קיבוץ גלויות 53 נהריה', 'underground', 2, false],
  [387, 'נחלת אשר 22 נהריה', 'underground', 2, false],
  [388, 'אביר יעקב 24 נהריה', 'underground', 2, false],
  [389, 'יחיעם 40 נהריה', 'underground', 2, false],
  [390, 'יחיעם 2 נהריה', 'underground', 2, false],
  [391, 'שביל הלל נהריה', 'underground', 2, true],
  [392, 'יחיעם 41 נהריה', 'underground', 2, false],
  [393, 'השרון 1 נהריה', 'underground', 2, true],
  [394, 'השרון 19 נהריה', 'underground', 2, false],
  [395, 'הגלעד 1 נהריה', 'underground', 2, false],
  [396, 'רבי עקיבא 24 נהריה', 'underground', 2, true],
  [397, 'אביר יעקב 27 נהריה', 'underground', 2, true],
  [398, 'נחלת אשר 25 נהריה', 'underground', 2, false],
  [399, 'קיבוץ גלויות 55 נהריה', 'underground', 2, false],
  // District 1
  [400, 'יהודה המכבי 26 נהריה', 'underground', 1, false],
  [407, 'החשמונאים 4 נהריה', 'underground', 1, false],
  [408, 'החלוץ 37 נהריה', 'underground', 1, false],
  [409, 'החשמונאים 11 נהריה', 'underground', 1, false],
  [410, 'החלוץ 67 נהריה', 'underground', 1, true],
  [411, 'החלוץ 26 נהריה', 'above', 1, false],
  [412, 'יהודה המכבי 17 נהריה', 'underground', 1, false],
  [413, 'יהודה המכבי 29 נהריה', 'underground', 1, false],
  [414, 'החלוץ 59 נהריה', 'underground', 1, false],
  [415, 'טרומפלדור 15 נהריה', 'underground', 1, false],
  [416, 'טרומפלדור 30 נהריה', 'underground', 1, false],
  [417, 'החלוץ 14 נהריה', 'underground', 1, false],
  [418, 'החלוץ 51 נהריה', 'underground', 1, true],
  [419, 'החשמונאים 11 נהריה', 'underground', 1, false],
  [420, 'כ"ג יורדי הסירה נהריה', 'underground', 1, false],
  [421, 'יהודה המכבי 7 נהריה', 'underground', 1, false],
  [422, 'יהודה המכבי 18 נהריה', 'underground', 1, false],
  [423, 'יהודה המכבי 33 נהריה', 'underground', 1, false],
  [424, 'החלוץ 52 נהריה', 'underground', 1, false],
  [425, 'החלוץ 14 נהריה', 'underground', 1, false],
  [426, 'חומה ומגדל 8 נהריה', 'underground', 1, false],
  [427, 'החלוץ 5 נהריה', 'underground', 1, true],
  [428, 'טרומפלדור 3 נהריה', 'underground', 1, false],
  [429, 'טרומפלדור 18 נהריה', 'underground', 1, false],
  [430, 'טרומפלדור 43 נהריה', 'underground', 1, false],
  [431, 'טרומפלדור 36 נהריה', 'underground', 1, false],
  [432, 'החלוץ 47 נהריה', 'underground', 1, false],
  [433, 'החלוץ 51 נהריה', 'underground', 1, false],
  [434, 'החלוץ 39 נהריה', 'underground', 1, false],
  [435, 'החלוץ 30 נהריה', 'underground', 1, false],
  [436, 'החלוץ 10 נהריה', 'underground', 1, false],
  [437, 'החלוץ 22 נהריה', 'underground', 1, false],
  [438, 'החלוץ 45 נהריה', 'underground', 1, false],
  [439, 'החלוץ 69 נהריה', 'underground', 1, false],
  [440, 'זמנהוף 5 נהריה', 'underground', 1, false],
  [441, 'החלוץ 35 נהריה', 'underground', 1, true],
  [442, 'החלוץ 52 נהריה', 'underground', 1, true],
  [507, 'ארלוזורוב 40 נהריה', 'underground', 1, true],
  // District 4
  [508, 'הגדוד העברי 10 נהריה', 'underground', 4, true],
  [509, 'העליה 7 נהריה', 'underground', 4, false],
  [510, 'ההגנה 38 נהריה', 'underground', 4, false],
  [512, 'בן גאון 18 נהריה', 'underground', 4, false],
  [513, 'יצחק שדה 1 נהריה', 'underground', 4, true],
  [514, 'ארלוזורוב 44 נהריה', 'above', 4, false],
  [515, 'ארלוזורוב 19 נהריה', 'accessible', 4, false],
  [516, 'ההדס 4 נהריה', 'underground', 4, false],
  [517, 'ביאליק 7 נהריה', 'underground', 4, false],
  [518, 'שביל הרקפת 6 נהריה', 'underground', 4, false],
  [519, 'שביל ההרדוף 1 נהריה', 'underground', 4, false],
  [521, 'ארלוזורוב 27 נהריה', 'underground', 4, false],
  [522, 'יבנה 1 נהריה', 'underground', 4, false],
  [523, 'יבנה 6 נהריה', 'underground', 4, false],
  [524, 'מסריק 29 נהריה', 'underground', 4, false],
  [526, 'קרן קיימת לישראל נהריה', 'underground', 4, false],
  [527, 'ארלוזורוב 43 נהריה', 'underground', 4, true],
  [529, 'ההגנה 5 נהריה', 'underground', 4, false],
  [530, 'ההגנה 38 נהריה', 'underground', 4, false],
  [531, 'הגדוד העברי 6 נהריה', 'underground', 4, false],
  [532, 'הנרקיס 3 נהריה', 'underground', 4, false],
  [533, 'ארלוזורוב 26 נהריה', 'underground', 4, true],
  [534, 'האשל 2 נהריה', 'underground', 4, false],
  [535, 'הוורד 3 נהריה', 'underground', 4, false],
  [536, 'שביל הנורית 1 נהריה', 'underground', 4, true],
  [560, 'בן גאון 31 נהריה', 'underground', 4, false],
  [561, 'בן גאון 31 נהריה', 'underground', 4, false],
  [562, 'ההגנה 44 נהריה', 'underground', 4, false],
  [563, 'בורכוב 7 נהריה', 'underground', 4, false],
  // Districts 5+6 and 7
  [700, 'הקישון 6 נהריה', 'underground', 7, true],
  [701, 'נורדאו 18 נהריה', 'underground', 56, false],
  [702, 'המיסדים 2 נהריה', 'underground', 56, false],
  [711, 'קרן היסוד 20 נהריה', 'underground', 56, true],
  [712, 'רמז 34 נהריה', 'underground', 56, true],
  [717, 'רמז 33 נהריה', 'underground', 56, true],
  [718, 'רמז 29 נהריה', 'underground', 56, true],
  [719, 'שי עגנון 32 נהריה', 'underground', 56, false],
  [720, 'בלפור 35 נהריה', 'underground', 56, false],
  [721, 'בלפור 22 נהריה', 'underground', 56, false],
  [722, 'המגינים 4 נהריה', 'underground', 56, true],
  [723, 'המגינים 12 נהריה', 'underground', 56, true],
  [725, 'דוד אלעזר 1 נהריה', 'underground', 56, true],
  [731, 'דרך בר יהודה 6 נהריה', 'accessible', 56, true],
  [734, 'המיסדים 5 נהריה', 'underground', 56, true],
  [735, 'שי עגנון 37 נהריה', 'underground', 56, true],
  [736, 'קפלן 46 נהריה', 'underground', 56, true],
  // Schools
  [null, 'עזרא 1 נהריה', 'school', 3, true],
  [null, 'אביר יעקב 15 נהריה', 'school', 2, true],
  [null, 'ביאליק נהריה', 'school', 4, true],
  [null, 'האיריס 44 נהריה', 'school', 56, true],
  [null, 'בלפור 71 נהריה', 'school', 56, true],
  [null, 'רמז 8 נהריה', 'school', 56, true],
  [null, 'ויצמן 88 נהריה', 'school', 56, true],
  [null, 'פנחס לבון 1 נהריה', 'school', 56, true],
];

const TYPE_LABELS = {
  underground: 'מקלט תת-קרקעי',
  above: 'מקלט עילי',
  accessible: 'מקלט נגיש',
  school: 'מקלט בית ספרי',
};

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || (() => {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = envFile.match(/GOOGLE_MAPS_API_KEY=(.+)/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
})();

async function geocode(address) {
  // Use Google Geocoding API for accurate house-number-level coordinates
  const url = 'https://maps.googleapis.com/maps/api/geocode/json?' + new URLSearchParams({
    address: address + ', ישראל',
    key: GOOGLE_API_KEY,
    language: 'he',
    region: 'il',
  });
  const res = await fetch(url, { timeout: 10000 });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 'OK' || !data.results || !data.results[0]) return null;
  const loc = data.results[0].geometry.location;
  const addressEn = data.results[0].formatted_address || '';
  return { lat: loc.lat, lon: loc.lng, addressEn };
}

async function main() {
  console.log(`Processing ${RAW_SHELTERS.length} Nahariya shelters (geocoding via Google)...`);

  const shelters = [];
  let geocodeOk = 0, geocodeFail = 0;

  for (let i = 0; i < RAW_SHELTERS.length; i++) {
    const [shelterId, addr, type, district, dual] = RAW_SHELTERS[i];
    const label = TYPE_LABELS[type] || 'מקלט ציבורי';
    const category = type === 'school' ? 'school' : 'public';

    // Geocode address
    const coords = await geocode(addr);
    if (!coords) {
      geocodeFail++;
      console.warn(`  [${i+1}/${RAW_SHELTERS.length}] No coords for: ${addr}`);
      continue;
    }
    geocodeOk++;
    if ((i + 1) % 20 === 0) {
      console.log(`  Geocoded ${i+1}/${RAW_SHELTERS.length}...`);
    }

    // Build clean address (strip city suffix)
    const cleanAddr = addr.replace(/ נהריה$/, '');

    shelters.push({
      id: `nahariya_${shelterId || 'school_' + i}`,
      lat: coords.lat,
      lon: coords.lon,
      name: shelterId ? `מקלט ${shelterId} - ${cleanAddr}` : `מקלט ${label} - ${cleanAddr}`,
      address: cleanAddr,
      city: 'נהריה',
      capacity: '',
      type: label,
      source: 'gov',
      category,
      addressEn: coords.addressEn || '',
    });

    // Small delay between requests
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`Geocoded: ${geocodeOk} ok, ${geocodeFail} failed`);

  const out = path.join(__dirname, '..', 'data', 'nahariya-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
