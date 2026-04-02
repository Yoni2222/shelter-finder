'use strict';
/**
 * Build Eilat shelters data.
 * Sources:
 *   - https://www.eilat.muni.il/רשימת-מקלטים-ציבוריים/
 *   - https://www.eilat.muni.il/רשימת-מקלטים-דו-תכליתיים/
 *
 * Only shelters with real street addresses are included.
 * Shelters with only building numbers ("סמוך ל-553") are skipped
 * because they can't be geocoded.
 *
 * Run: node scripts/build-eilat-data.js
 */

const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyB6rgqJ418JtjyhYGzamDqpFt_ugYBMD_g';

// Dual-purpose shelters (דו-תכליתיים) — all have real addresses
// Format: [id, address, currentUse]
const DUAL_PURPOSE = [
  ["א'-3", 'המלחה 12', 'בית כנסת ישורון'],
  ["א'-5", 'האשלג 1', 'מועדונית נוער וילדים'],
  ["א'-7", 'הצוק 6', 'עמותת לב אחים'],
  ["א'-22", 'החורב 3', 'מרכז קליטה'],
  ["א'-23", 'החורב 15', 'אימוני כושר'],
  ["א'-24", 'חטיבת גולני 4', 'אגרוף'],
  ["א'-25", 'הגופרית 8', 'אימוני ספורט'],
  ["ב'-1", 'שד\' ירושליים השלמה 34', null],
  ["ב'-3", 'התמרים 63', 'בית מדרש'],
  ["ב'-5", 'ברנע 57', 'פעילות ציבורית'],
  ["ב'-6", 'ברנע 12', 'בית כנסת היכל אברהם'],
  ["ב'-9", 'מישר 4', null],
  ["ב'-10", 'מישר 4', null],
  ["ב'-12", 'נחושתן 41', 'בית כנסת ארגון עולי הודו'],
  ["ב'-13", 'ירושלים השלמה 2', 'מדרשה לבנות'],
  ["ב'-14", 'אדום 33', 'לימודי שייט'],
  ["ב'-19", 'אילות 10', 'עולי ארגנטינה'],
  ["ב'-20", 'השיטה 22', 'קרן הנדין'],
  ["ב'-31", 'ארנון 43', 'תאטרון רוסי'],
  ["ב'-32", 'ברנע 8', null],
  ["ב'-33", 'השיטה 2', null],
  ["ג'-3", 'חצרות 4', 'בית כנסת שערי תפילה'],
  ["ג'-7", 'צין 30', 'גודו'],
  ["ג'-11", 'מרווה 31', 'מוזיקה'],
  ["ג'-12", 'רותם 14', 'בית כנסת שמחת ישראל'],
  ["ג'-16", 'קדש 19', 'בית כנסת מתימן'],
  ["ג'-17", 'כלנית 12', 'היאבקות'],
  ["מע'-1-1", 'הספורטאים 24', 'התנדבות אל עמי'],
  ["מע'-2-6", 'האצטדיון 4', 'התנדבות אל עמי'],
  ["מע'-2-9", 'גרניט 12', 'עמותת אריאל'],
  ["מע'-2-12", 'ציפחה 10', 'רותם פיט ספורט'],
  ["מע'-6-5", 'מקור החסידה 11', 'מרכז פ.ל.א.'],
  ["צ.ת.-3", 'די זהב 3', 'להקה יו לייב'],
  ["צ.ת.-4", 'סמטת צוקים 2', 'מכון הגיאופיסי'],
];

// Public shelters (ציבוריים) — only the ones with real street addresses
const PUBLIC_WITH_ADDRESS = [
  ["א'-8", 'יעלים 16'],
  ["ד'-5", 'משעול שגיא'],
];

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.results && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const type = data.results[0].geometry.location_type;
    // Skip APPROXIMATE results (city-level, useless)
    if (type === 'APPROXIMATE') return null;
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address, type };
  }
  return null;
}

async function main() {
  const shelters = [];
  let success = 0, fail = 0;

  // Process dual-purpose shelters
  for (const [id, address, currentUse] of DUAL_PURPOSE) {
    const fullAddr = `${address}, אילת, ישראל`;
    const geo = await geocode(fullAddr);
    if (geo) {
      shelters.push({
        id: `eilat_${id.replace(/[^a-zA-Z0-9א-ת]/g, '_')}`,
        lat: geo.lat,
        lon: geo.lon,
        name: `מקלט ${id} - ${address}`,
        address,
        city: 'אילת',
        capacity: '',
        type: 'דו-תכליתי',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log(`✓ ${id}: ${address} → ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`✗ ${id}: ${address} → FAILED`);
    }
    // Rate limit: 50ms between requests
    await new Promise(r => setTimeout(r, 50));
  }

  // Process public shelters with real addresses
  for (const [id, address] of PUBLIC_WITH_ADDRESS) {
    const fullAddr = `${address}, אילת, ישראל`;
    const geo = await geocode(fullAddr);
    if (geo) {
      shelters.push({
        id: `eilat_${id.replace(/[^a-zA-Z0-9א-ת]/g, '_')}`,
        lat: geo.lat,
        lon: geo.lon,
        name: `מקלט ${id} - ${address}`,
        address,
        city: 'אילת',
        capacity: '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log(`✓ ${id}: ${address} → ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      fail++;
      console.log(`✗ ${id}: ${address} → FAILED`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nTotal: ${success} geocoded, ${fail} failed out of ${DUAL_PURPOSE.length + PUBLIC_WITH_ADDRESS.length}`);

  const outPath = path.join(__dirname, '..', 'data', 'eilat-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);
}

main().catch(console.error);
