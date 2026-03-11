'use strict';
const fs = require('fs'), path = require('path');
const fetch = require('node-fetch');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geocode(address) {
  const q = address + ', נתניה, ישראל';
  const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=1&countrycodes=il';
  const res = await fetch(url, { headers: { 'User-Agent': 'ShelterFinderBuild/1.0' }, timeout: 10000 });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

function parseAddress(desc) {
  // Try: ברחוב <street> <num>
  let m = desc.match(/ברחוב\s+([\u0590-\u05FF\s"']+?)\s+(\d+)/);
  if (m) return { street: m[1].trim(), houseNum: m[2] };
  // Try: ברחוב <street> פינת <cross>
  m = desc.match(/ברחוב\s+([\u0590-\u05FF\s"']+?)\s+פינת\s+([\u0590-\u05FF\s"']+?)[\.,\s]/);
  if (m) return { street: m[1].trim() + ' פינת ' + m[2].trim(), houseNum: '' };
  // Try corner: פינת הרחובות <s1> ו<s2>
  m = desc.match(/פינת הרחובות\s+([\u0590-\u05FF\s"']+?)\s+ו([\u0590-\u05FF\s"']+?)[\.,\s]/);
  if (m) return { street: m[1].trim() + ' פינת ' + m[2].trim(), houseNum: '' };
  // Try: בכיכר <name>
  m = desc.match(/בכיכר\s+([\u0590-\u05FF\s"']+?)[\.,\s]/);
  if (m) return { street: 'כיכר ' + m[1].trim(), houseNum: '' };
  // Try: ברחוב <street> מול מספר <num>
  m = desc.match(/ברחוב\s+([\u0590-\u05FF\s"']+?)\s+מול\s+(?:מספר\s+|מס'?\s*)?(\d+)/);
  if (m) return { street: m[1].trim(), houseNum: m[2] };
  // Fallback: ברחוב <anything>
  m = desc.match(/ברחוב\s+([\u0590-\u05FF\s"'-]+)/);
  if (m) return { street: m[1].trim(), houseNum: '' };
  return null;
}

function parseNeighborhood(desc) {
  let m = desc.match(/בשכונת\s+["']?([^,."']+)/);
  if (m) return m[1].trim();
  m = desc.match(/שכונת\s+["']?([^,."']+)/);
  if (m) return m[1].trim();
  // Try area descriptions like "רמת אפרים", "במרכז נתניה"
  m = desc.match(/,\s+(רמת\s+[\u0590-\u05FF]+)/);
  if (m) return m[1].trim();
  return '';
}

// Scraped from Netanya municipality website (SharePoint, client-side rendered)
// Source: https://www.netanya.muni.il/City/SecurityAndEmergency/DS/shelters/Pages/default.aspx
// Data extracted via browser automation on 2026-03-11
const SCRAPED = [
  { n: '1', d: 'מקלט מס. 1 ממוקם ברחוב הרימון 20 בנתניה' },
  { n: '2', d: 'מקלט מספר 2 ממוקם ברחוב המלכים פינת הביכורים, בשכונת עין התכלת' },
  { n: '3', d: 'מקלט מספר 3 ממוקם ברחוב הנרקיס 3, בשכונת עין התכלת' },
  { n: '4', d: 'מקלט מספר 4. ממוקם ברחוב הנרקיס 9, בשכונת עין התכלת' },
  { n: '5', d: 'מקלט מספר 5. ממוקם בפינת הרחובות דברי חיים ונווה שלום, בשכונת עין התכלת' },
  { n: '6', d: 'מקלט מספר 6 ממוקם ברחוב הזית 1, בשכונת עין התכלת' },
  { n: '7', d: 'מקלט מספר 7. ממוקם ברחוב הרקפת 2, בשכונת עין התכלת' },
  { n: '8', d: 'מקלט מספר 8 ממוקם ברחוב החשמונאים, במרכז נתניה' },
  { n: '9', d: 'מקלט מספר 9 ממוקם ברחוב יוספטל 27, בשכונת נאות הרצל' },
  { n: '10', d: 'מקלט מספר 10 ממוקם ברחוב עולי הגרדום 27, בשכונת סלע' },
  { n: '11', d: 'מקלט מספר 11 ממוקם ברחוב יצחק שדה 7' },
  { n: '12', d: 'מקלט מספר 12 ממוקם ברחוב טרומפלדור 36, בשכונת מרכז העיר' },
  { n: '13', d: 'מקלט מספר 13 ממוקם ברחוב בארי 61, בשכונת מרכז העיר' },
  { n: '15', d: 'מקלט מספר 15 ממוקם ברחוב בר יוחאי 20, בשכונת נאות הרצל' },
  { n: '16', d: 'מקלט מספר 16 ממוקם ברחוב בר יוחאי 1, בשכונת נאות הרצל' },
  { n: '17', d: 'מקלט מספר 17 ממוקם ברחוב יוחנן הסנדלר 12, בשכונת נאות הרצל' },
  { n: '18', d: 'מקלט מספר 18 ממוקם ברחוב דב הוז 6, בשכונת נאות הרצל' },
  { n: '19', d: 'מקלט מספר 19 ממוקם ברחוב גליקסמן פינת פרישמן, בשכונת נאות הרצל' },
  { n: '20', d: 'מקלט מספר 20 ממוקם ברחוב יוספטל 25, בשכונת נאות הרצל' },
  { n: '21', d: 'מקלט מספר 21 ממוקם ברחוב שמשון 21, בשכונת נאות הרצל' },
  { n: '22', d: 'מקלט מספר 22 ממוקם בפינת הרחובות מוהליבר ועציון, בשכונת מרכז העיר' },
  { n: '23', d: 'מקלט מספר 23 ממוקם ברחוב בורוכוב 5, בשכונת מרכז העיר' },
  { n: '24', d: 'מקלט מספר 24 ממוקם ברחוב קפלנסקי 6, בשכונת מרכז העיר' },
  { n: '27', d: 'מקלט מספר 27 ממוקם ברחוב גדעון 11, בשכונת נאות הרצל' },
  { n: '29', d: 'מקלט מספר 29 ממוקם ברחוב יוספטל 10, בשכונת נאות הרצל' },
  { n: '30', d: 'מקלט מס. 30 נמצא ברחוב ברק בן אבינועם 12, בשכונת נאות הרצל' },
  { n: '38', d: 'מקלט מספר 38 נמצא ברחוב שרה מלכין 11, בשכונת נאות גנים' },
  { n: '39', d: 'מקלט מספר 39 ממוקם ברחוב קפלן 20, בשכונת נאות גנים' },
  { n: '40', d: 'מקלט מספר 40 ממוקם ברחוב ויתקין מול מספר 3, בשכונת נאות גנים' },
  { n: '41', d: 'מקלט מספר 41 ממוקם ברחוב אלומות 31, בשכונת נאות גנים' },
  { n: '42', d: 'מקלט מספר 42 ממוקם ברחוב קפלן 32, בשכונת נאות גנים' },
  { n: '43', d: 'מקלט מספר 43 ממוקם ברחוב סירקין 21, בשכונת נאות גנים' },
  { n: '44', d: 'מקלט מספר 44 ממוקם ברחוב ויתקין 29, בשכונת נאות גנים' },
  { n: '45', d: 'מקלט מספר 45 נמצא ברחוב גוטמכר מול מספר 11, בשכונת נאות גנים' },
  { n: '46', d: 'מקלט מס. 46 נמצא ברחוב ויתקין מול מס 41, בשכונת נאות גנים' },
  { n: '47', d: 'מקלט מספר 47 נמצא ברחוב שפרינצק 20, בשכונת נאות גנים' },
  { n: '48', d: 'מקלט מספר 48 ממוקם ברחוב עובדיה 32, בשכונת נאות גנים' },
  { n: '49', d: 'מקלט מספר 49 נמצא ברחוב שפרינצק 35, בשכונת נאות גנים' },
  { n: '50', d: 'מקלט מספר 50 נמצא ברחוב הלפרין 10, בשכונת נאות גנים' },
  { n: '51', d: 'מקלט מספר 51 נמצא ברחוב זייד 18, בשכונת נאות גנים' },
  { n: '52', d: 'מקלט מספר 52 נמצא ברחוב צירלסון 13, בשכונת נאות גנים' },
  { n: '53', d: 'מקלט מספר 53 נמצא ברחוב גולד 14, בשכונת נאות גנים' },
  { n: '54', d: 'מקלט מספר 54 נמצא ברחוב שחל פינת נויפלד, בשכונת נאות גנים' },
  { n: '55', d: 'מקלט מספר 55 ממוקם ברחוב דבורה פינת וולפסון, בשכונת נווה איתמר' },
  { n: '56', d: 'מקלט מספר 56 נמצא ברחוב שמואל דיין 5, בשכונת נאות גנים' },
  { n: '57', d: 'מקלט מספר 57 נמצא ברחוב שמואל דיין 19, בשכונת נאות גנים' },
  { n: '58', d: 'מקלט מספר 58 נמצא ברחוב בוסל מול מספר 34, בשכונת נאות גנים' },
  { n: '58א', d: 'מקלט מס 58 א נמצא ברחוב בוסל מול מספר 46, בשכונת נאות גנים' },
  { n: '59', d: 'מקלט מספר 59 נמצא ברחוב אנילביץ 15, רמת אפרים' },
  { n: '60', d: 'מקלט מספר 60 נמצא ברחוב סטרומה 13, רמת אפרים' },
  { n: '62', d: 'מקלט מספר 62 נמצא ברחוב החלוצים פינת הס, במרכז העיר' },
  { n: '64', d: 'מקלט מספר 64 נמצא ברחוב לומיר פינת הרצל' },
  { n: '65', d: 'מקלט מספר 65 נמצא ברחוב עובדיה בן שלום 16, במרכז נתניה' },
  { n: '66', d: 'מקלט מספר 66 ממוקם ברחוב בן אליעזר 55, במרכז נתניה' },
  { n: '67', d: 'מקלט מספר 67 נמצא ברחוב שרעבי 15, בשכונת רמת חן' },
  { n: '68', d: 'מקלט מספר 68. נמצא ברחוב אלחריזי 7, בשכונת רמת חן' },
  { n: '69', d: 'מקלט מספר 69. נמצא ברחוב חתם סופר 26, בשכונת רמת חן' },
  { n: '70', d: 'מקלט מספר 70. נמצא ברחוב אבן עזרא 30, רמת חן' },
  { n: '71', d: 'מקלט מספר 71 נמצא ברחוב הרב ברוד 5, בשכונת נוף הטיילת' },
  { n: '75', d: 'מקלט מספר 75 נמצא ברחוב אחימאיר 9, במרכז העיר' },
  { n: '76', d: 'מקלט מספר 76. נמצא בכיכר אבות, בשכונת רמת ידין-דורה' },
  { n: '77', d: 'מקלט מספר 77. נמצא ברחוב שמואל 21, בשכונת רמת ידין-דורה' },
  { n: '78', d: 'מקלט מספר 78. נמצא ברחוב יחזקאל 34, בשכונת רמת ידין-דורה' },
  { n: '79', d: 'מקלט מספר 79. נמצא ברחוב ישעיהו 7, בשכונת רמת ידין-דורה' },
  { n: '80', d: 'מקלט מספר 80. נמצא ברחוב קדושי עיראק 20, בשכונת רמת ידין-דורה' },
  { n: '81', d: 'מקלט מספר 81. נמצא ברחוב ישעיהו 23, בשכונת רמת ידין-דורה' },
  { n: '82', d: 'מקלט מספר 82. נמצא ברחוב יחזקאל 30, בשכונת רמת ידין-דורה' },
  { n: '83', d: 'מקלט מספר 83. נמצא ברחוב נחום 11, בשכונת רמת ידין-דורה' },
  { n: '84', d: 'מקלט מספר 84. נמצא ברחוב נחום 13, בשכונת רמת ידין-דורה' },
  { n: '89', d: 'מקלט מספר 89. נמצא ברחוב נורדאו 51, בשכונת קרית נורדאו' },
  { n: '90', d: 'מקלט מספר 90. נמצא ברחוב קרן היסוד 5, בשכונת קרית נורדאו' },
  { n: '91', d: 'מקלט מספר 91. נמצא ברחוב ויצמן 4, בשכונת קרית נורדאו' },
  { n: '96', d: 'מקלט מספר 96. נמצא ברחוב קרן היסוד 5, בשכונת קרית נורדאו' },
];

async function main() {
  console.log('Processing ' + SCRAPED.length + ' scraped Netanya shelters...');
  const shelters = [];
  const toGeocode = [];

  for (let i = 0; i < SCRAPED.length; i++) {
    const { n, d } = SCRAPED[i];
    const addr = parseAddress(d);
    const neighborhood = parseNeighborhood(d);
    const street = addr ? (addr.street + (addr.houseNum ? ' ' + addr.houseNum : '')) : '';

    const shelter = {
      id: 'netanya_pub_' + (i + 1),
      lat: null,
      lon: null,
      name: 'מקלט ' + n + (street ? ' - ' + street : ''),
      address: street,
      city: 'נתניה',
      neighborhood: neighborhood,
      capacity: '',
      type: 'מקלט ציבורי',
      source: 'gov',
      category: 'public',
    };
    shelters.push(shelter);
    if (street) {
      toGeocode.push({ index: shelters.length - 1, address: street });
    }
  }

  console.log('Need to geocode: ' + toGeocode.length + ' shelters');
  let geocoded = 0, failed = 0;
  for (const item of toGeocode) {
    const result = await geocode(item.address);
    if (result) {
      shelters[item.index].lat = result.lat;
      shelters[item.index].lon = result.lon;
      geocoded++;
    } else {
      failed++;
      console.warn('  Geocode failed: "' + item.address + '"');
    }
    await sleep(1100);
  }
  console.log('Geocoded: ' + geocoded + ' success, ' + failed + ' failed');

  const valid = shelters.filter(s => s.lat && s.lon);
  console.log('Final: ' + valid.length + ' shelters with coordinates (dropped ' + (shelters.length - valid.length) + ')');

  const out = path.join(__dirname, '..', 'data', 'netanya-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(valid, null, 2), 'utf8');
  console.log('Saved ' + valid.length + ' shelters to ' + out);
}

main().catch(e => { console.error(e.message); process.exit(1); });
