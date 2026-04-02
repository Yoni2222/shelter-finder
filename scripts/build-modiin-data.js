'use strict';
/**
 * Build shelters data for:
 *   1. מודיעין עילית (Modi'in Illit) — 10 shelters from municipality
 *   2. מודיעין-מכבים-רעות (Modi'in-Maccabim-Re'ut) — ~40 shelters
 *      https://www.modiin.muni.il/modiinwebsite/ArticlePage.aspx?PageID=1095_2176
 *
 * Run: GOOGLE_MAPS_API_KEY=... node scripts/build-modiin-data.js
 */

const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyB6rgqJ418JtjyhYGzamDqpFt_ugYBMD_g';

// ========== מודיעין עילית ==========
// From municipality website screenshot — 10 public shelters
const MODIIN_ILLIT = [
  ['1', 'הגר"א 1', 'מרכז קהילתי הגר"א'],
  ['2', 'אור החיים 29', 'מקלט בתלמוד תורה אהלי ספר בנים'],
  ['3', 'משך חכמה', 'מתחם הגנים של דרך אמת (מתחת לבית הכנסת אהל מנחם)'],
  ['4', 'מנחת חינוך 7', 'בית יעקב החדש'],
  ['5', 'מסילת יוסף 10', 'מקלט בגני הילדים (פינת חתם סופר)'],
  ['6', 'משך חכמה 41', 'אולם-מקלט מתחת בית הכנסת קהילת משך חכמה'],
  ['7', 'שדי חמד 11', 'שלושה ממ"דים בקומפלקס בתי כנסת'],
  ['8', 'חפץ חיים 2', 'מקלט בבית כנסת אנשי ירושלים (פינת אור החיים)'],
  ['9', 'רבי עקיבא 39', 'תלמוד תורה המסילה'],
  ['10', 'אורחות צדיקים 4', 'תלמוד תורה דרך אמת'],
];

// ========== מודיעין-מכבים-רעות ==========
// רובע רעות — shelters 1-18
const REUT = [
  ['1', 'גבעת הלבונה', 'מקלט רעות א\''],
  ['2', 'גלבוע', 'מקלט רעות ב\''],
  ['3', 'תבור', 'מקלט רעות ג\''],
  ['4', 'שדרות אורנים פינת ארז', 'מקלט רעות ד\''],
  ['5', 'ברוש', 'מקלט רעות ה\''],
  ['6', 'חרמון', 'מקלט רעות ו\''],
  ['7', 'שיקמה פינת תמר', 'מקלט רעות ז\''],
  ['8', 'רותם פינת הדס', 'מקלט רעות ח\''],
  ['9', 'תאנה', 'מקלט רעות ט\''],
  ['10', 'שדרות הפרחים', 'מקלט רעות י\''],
  ['11', 'אירוסים', 'מקלט רעות יא\''],
  ['12', 'חצב', 'מקלט רעות יב\''],
  ['13', 'יקינטון פינת חבצלת', 'מקלט רעות יג\''],
  ['14', 'אירוסים פינת נרקיס', 'מקלט רעות יד\''],
  ['15', 'אלמוג', 'מקלט רעות טו\''],
  ['16', 'קשת', 'מקלט רעות טז\''],
  ['17', 'קשת', 'מקלט רעות יז\''],
  ['18', 'שוהם פינת שדרות עומרים', 'מקלט רעות יח\''],
];

// רובע מכבים — shelters 401-422
const MACCABIM = [
  ['401', 'אנפה', 'מקלט מכבים 401', "מכבים ב'"],
  ['402', 'אנפה', 'מקלט מכבים 402', "מכבים ב'"],
  ['403', 'ברקנית', 'מקלט מכבים 403', "מכבים ב'"],
  ['404', 'גדי', 'מקלט מכבים 404', "מכבים ב'"],
  ['405', 'טבלן', 'מקלט מכבים 405', "מכבים ב'"],
  ['406', 'לביא', 'מקלט מכבים 406', "מכבים ב'"],
  ['407', 'נקר פינת סנונית', 'מקלט מכבים 407', "מכבים ב'"],
  ['408', 'עגור', 'מקלט מכבים 408', "מכבים ב'"],
  ['409', 'עגור', 'מקלט מכבים 409', "מכבים ב'"],
  ['411', 'הר אמיר', 'מקלט מכבים 411', "מכבים ג1"],
  ['412', 'הר דלתון', 'מקלט מכבים 412', "מכבים ג1"],
  ['413', 'הר זיו', 'מקלט מכבים 413', "מכבים ג1"],
  ['414', 'רכסים', 'מקלט מכבים 414', "מכבים ג1"],
  ['415', 'הר עמינדב', 'מקלט מכבים 415', "מכבים ג1"],
  ['416', 'הר פורת', 'מקלט מכבים 416', "מכבים ג1"],
  ['417', 'הר שחר', 'מקלט מכבים 417', "מכבים ג1"],
  ['418', 'יובלים', 'מקלט מכבים 418', "מכבים ג1"],
  ['419', 'יובלים', 'מקלט מכבים 419', "מכבים ג2"],
  ['420', 'נחל עוז', 'מקלט מכבים 420', "מכבים ג2"],
  ['421', 'נחל כיסופים', 'מקלט מכבים 421', "מכבים ג2"],
  ['422', 'נחל חרות', 'מקלט מכבים 422', "מכבים ג2"],
];

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const type = data.results[0].geometry.location_type;
    if (type === 'APPROXIMATE') return null;
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address, type };
  }
  return null;
}

async function buildCity(entries, city, prefix, neighborhood) {
  const shelters = [];
  let success = 0, fail = 0;

  for (const entry of entries) {
    const [id, address, name, hood] = entry;
    const area = hood || neighborhood || '';
    const fullAddr = area
      ? `${address}, ${area}, ${city}, ישראל`
      : `${address}, ${city}, ישראל`;
    const geo = await geocode(fullAddr);
    if (geo) {
      shelters.push({
        id: `${prefix}_${id}`,
        lat: geo.lat,
        lon: geo.lon,
        name,
        address,
        city,
        capacity: '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log(`  ✓ ${id}: ${address} → ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`  ✗ ${id}: ${address} → FAILED`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  return { shelters, success, fail };
}

async function main() {
  // ===== מודיעין עילית =====
  console.log('=== מודיעין עילית ===');
  const illit = await buildCity(MODIIN_ILLIT, 'מודיעין עילית', 'modiin_illit', '');
  const illitPath = path.join(__dirname, '..', 'data', 'modiin-illit-shelters.json');
  fs.writeFileSync(illitPath, JSON.stringify(illit.shelters, null, 2), 'utf8');
  console.log(`\nמודיעין עילית: ${illit.success} geocoded, ${illit.fail} failed out of ${MODIIN_ILLIT.length}`);
  console.log(`Written to ${illitPath}\n`);

  // ===== מודיעין-מכבים-רעות =====
  console.log('=== רעות ===');
  const reut = await buildCity(REUT, 'מודיעין-מכבים-רעות', 'modiin_reut', 'רעות');
  console.log(`\nרעות: ${reut.success} geocoded, ${reut.fail} failed out of ${REUT.length}\n`);

  console.log('=== מכבים ===');
  const maccabim = await buildCity(MACCABIM, 'מודיעין-מכבים-רעות', 'modiin_maccabim', '');
  console.log(`\nמכבים: ${maccabim.success} geocoded, ${maccabim.fail} failed out of ${MACCABIM.length}\n`);

  const allMaccabimReut = [...reut.shelters, ...maccabim.shelters];
  const mrPath = path.join(__dirname, '..', 'data', 'modiin-maccabim-reut-shelters.json');
  fs.writeFileSync(mrPath, JSON.stringify(allMaccabimReut, null, 2), 'utf8');
  console.log(`מודיעין-מכבים-רעות total: ${allMaccabimReut.length} shelters`);
  console.log(`Written to ${mrPath}`);
}

main().catch(console.error);
