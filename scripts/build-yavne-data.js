'use strict';
/**
 * Build Yavne shelters data from municipality list.
 * Run: GOOGLE_API_KEY=... node scripts/build-yavne-data.js
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch (_) {}
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_API_KEY or GOOGLE_MAPS_API_KEY'); process.exit(1); }

const CITY = 'יבנה';
const DELAY = 200;

// Raw data: name|address
const RAW = `מקלט מספר 2|הר סיני 4
מקלט מספר 3|גלבוע 14
מקלט מספר 4|גלבוע 27
מקלט מספר 5|גלבוע 28
מקלט מספר 6|חרמון תבור
מקלט מספר 7|נשיאים 11
מקלט מספר 8|נשיאים 2
מקלט מספר 9|דוד אלעזר 8
מקלט מספר 10|מבצע יהונתן 10
מקלט מספר 11|בוכריס 3
מקלט מספר 12|מרכז הפעלה
מקלט מספר 13|לילך 1
מקלט מספר 14|לילך 3
מקלט מספר 15|שבזי 10
מקלט מספר 16|דואני 33
מקלט מספר 17|דואני 55
מקלט מספר 18|חבצלת 35
מקלט מספר 19|חבצלת-אבוחצרא
מקלט מספר 20|סביון 2
מקלט מספר 21|צבעוני 21
מקלט מספר 22|צבעוני 27
מקלט מספר 23|צבעוני 31
מקלט מספר 24|צבעוני 45
מקלט מספר 25|צבעוני 49
מקלט מספר 26|מחסן
מקלט מספר 27|אורגים 27
מקלט מספר 28|האלון 12
מקלט מספר 29|האלון 19
מקלט מספר 30|האלון 24
מקלט מספר 31|האלון 27
מקלט מספר 32|משעול הגויאבה
מקלט מספר 33|כליל החורש
מקלט מספר 34|הגולן 37
מקלט מספר 35|הגולן 53
מקלט מספר 36|ניצנית 9
מקלט מספר 37|ניצנית 54
מקלט מספר 38|יערה 32
מקלט מספר 39|יערה 35
מקלט מספר 40|יערה 50
מקלט מספר 41|יערה 86
מקלט מספר 42|צורית 5
מקלט מספר 43|דולב 22
מקלט מספר 44|סיגל 7
מקלט מספר 45|מתנ"ח
מקלט מספר 46|מתנ"ח
מקלט מספר 47|מבצע קדש
מיגונית מספר 1|ערבה 20
מיגונית מספר 2|ערבה 50
מיגונית מספר 3|ערבה 60
מיגונית מספר 4|קרוואנים
מיגונית מספר 5|עירייה
מיגונית מספר 6|נגב
מיגונית מספר 7|שרון שומרון
מיגונית מספר 8|כרמל 2
מיגונית|האלון 6
מיגונית|האלון 8
בית ספר נעם|הערבה 20
בית ספר ביאליק|שבזי
בית ספר יחידני|הדרור 21
בית ספר בן גוריון|כניסה מהשער האחרוני דרך רחוב הנשר
מרכז הספורט|האלון 37
מתנ"ס גרמנוב|התנאים 1
בית ספר כנפי אבירים|שבזי 24
בית ספר סיני בנות|הגלבוע 4
בית תמחוי-בני ברית|האורן 10
בית ספר מעיין|הנורית פינת החרוב
מיגונית בית העלמין יבנה|בכניסה לבית העלמין`;

// Yavne bounding box
const BOUNDS = { latMin: 31.855, latMax: 31.895, lonMin: 34.720, lonMax: 34.765 };

function inBounds(lat, lon) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax &&
         lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax;
}

// Address cleaning rules
function cleanAddress(rawAddr) {
  const addr = rawAddr.trim();
  // Skip entries with no geocodable address
  if (addr === 'מרכז הפעלה') return null;          // skip
  if (addr === 'מתנ"ח') return null;                 // skip (2 entries)
  if (addr === 'קרוואנים') return null;              // skip

  // Intersections: use first street
  if (addr === 'חרמון תבור') return 'חרמון';
  if (addr === 'חבצלת-אבוחצרא') return 'חבצלת';

  // Landmarks / descriptive addresses
  if (addr === 'מחסן') return 'מחסן עירוני';
  if (addr === 'עירייה') return 'עירייה יבנה';
  if (addr === 'נגב') return 'נגב';
  if (addr === 'שרון שומרון') return 'שרון';
  if (addr === 'כניסה מהשער האחרוני דרך רחוב הנשר') return 'הנשר';
  if (addr === 'בכניסה לבית העלמין') return 'בית העלמין יבנה';
  if (addr === 'הנורית פינת החרוב') return 'הנורית';

  return addr;
}

async function geocode(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.status !== 'OK' || !data.results || data.results.length === 0) return null;
  const result = data.results[0];
  const loc = result.geometry.location;
  const locType = result.geometry.location_type;
  if (locType === 'APPROXIMATE') {
    console.log(`  [approx] ${query} -> ${loc.lat},${loc.lng} (${result.formatted_address})`);
    // Still accept APPROXIMATE for landmark addresses
  }
  if (!inBounds(loc.lat, loc.lng)) {
    console.log(`  [bounds] Rejected ${query} -> ${loc.lat},${loc.lng} (${result.formatted_address})`);
    return null;
  }
  return { lat: loc.lat, lon: loc.lng, formatted: result.formatted_address, type: locType };
}

async function geocodeEntry(cleanAddr) {
  // Try Hebrew query first
  let geo = await geocode(`${cleanAddr}, ${CITY}, ישראל`);
  if (geo) return geo;

  // Try without city qualifier for landmarks
  await new Promise(r => setTimeout(r, DELAY));
  geo = await geocode(`${cleanAddr}, ${CITY}`);
  return geo;
}

function parseEntries() {
  const lines = RAW.trim().split('\n');
  const entries = [];
  for (const line of lines) {
    const [name, rawAddr] = line.split('|');
    const cleaned = cleanAddress(rawAddr);
    if (cleaned === null) {
      console.log(`SKIP: ${name} (${rawAddr})`);
      continue;
    }
    entries.push({ name: name.trim(), address: cleaned, rawAddress: rawAddr.trim(), city: CITY });
  }
  return entries;
}

async function main() {
  const entries = parseEntries();

  // Write input JSON
  const inputPath = path.join(__dirname, 'yavne-input.json');
  fs.writeFileSync(inputPath, JSON.stringify(entries.map(e => ({
    name: e.name, address: e.address, city: e.city
  })), null, 2), 'utf8');
  console.log(`\nWrote ${entries.length} entries to ${inputPath}\n`);

  const shelters = [];
  const failures = [];
  let counter = 0;

  for (const entry of entries) {
    counter++;
    const geo = await geocodeEntry(entry.address);

    if (geo) {
      const id = `יבנה-${counter}`;
      shelters.push({
        id,
        lat: geo.lat,
        lon: geo.lon,
        name: entry.name,
        address: `${entry.rawAddress}, ${CITY}`,
        city: CITY,
        neighborhood: '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
      });
      console.log(`OK [${counter}] ${entry.name}: ${entry.address} -> ${geo.lat}, ${geo.lon} (${geo.type})`);
    } else {
      failures.push({ name: entry.name, address: entry.address, rawAddress: entry.rawAddress });
      console.log(`FAIL [${counter}] ${entry.name}: ${entry.address}`);
    }

    await new Promise(r => setTimeout(r, DELAY));
  }

  // Write outputs
  const outputPath = path.join(__dirname, 'yavne-output.json');
  fs.writeFileSync(outputPath, JSON.stringify({ shelters, failures }, null, 2), 'utf8');
  console.log(`\nWrote output to ${outputPath}`);

  const dataPath = path.join(__dirname, '..', 'data', 'yavne-shelters.json');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Wrote ${shelters.length} shelters to ${dataPath}`);

  // Stats
  console.log(`\n=== Stats ===`);
  console.log(`Total entries: ${entries.length}`);
  console.log(`Skipped (no address): ${RAW.trim().split('\n').length - entries.length}`);
  console.log(`Geocoded OK: ${shelters.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length > 0) {
    console.log(`\nFailed entries:`);
    for (const f of failures) {
      console.log(`  - ${f.name} (${f.rawAddress} -> ${f.address})`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
