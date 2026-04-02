const fs = require('fs');
const path = require('path');

// Final consolidated geocoding results for 19 Kiryat Gat shelters
// Sources:
//   - Google Geocoding API: רחבת streets (accurate with house numbers)
//   - OSM Overpass API: מבצע streets, רחבת גד, רחבת יששכר, מבוא התבור, משעול הגלבוע
//   - Google Maps Search (browser): משעול מנשה (31.6163002, 34.7695483)
//   - Known: הגלבוע 10

const results = [
  // === רחבת streets — Google Geocoding API (address-level accuracy) ===
  { name: 'מקלט רחבת צופר 7', address: 'רחבת צופר 7',
    lat: 31.601344, lon: 34.757719 },
  { name: 'מקלט רחבת באר אורה 17', address: 'רחבת באר אורה 17',
    lat: 31.600538, lon: 34.75803 },
  { name: 'מקלט רחבת קטורה 17', address: 'רחבת קטורה 17',
    lat: 31.600059, lon: 34.757435 },
  { name: 'מקלט רחבת שיזפון 17', address: 'רחבת שיזפון 17',
    lat: 31.599812, lon: 34.756687 },
  { name: 'מקלט רחבת גרופית 14', address: 'רחבת גרופית 14',
    lat: 31.599411, lon: 34.755948 },
  { name: 'מקלט רחבת חלוצה 8', address: 'רחבת חלוצה 8',
    lat: 31.599731, lon: 34.754983 },
  { name: 'מקלט רחבת רותם 27', address: 'רחבת רותם 27',
    lat: 31.602544, lon: 34.753631 },
  { name: 'מקלט רחבת ימין 16', address: 'רחבת ימין 16',
    lat: 31.603526, lon: 34.752799 },

  // === מבצע streets — OSM Overpass (street centerline) ===
  { name: 'מקלט מבצע עובדה 29', address: 'מבצע עובדה 29',
    lat: 31.6044127, lon: 34.7525204 },
  { name: 'מקלט מבצע חורב 23', address: 'מבצע חורב 23',
    lat: 31.6051966, lon: 34.7521013 },
  { name: 'מקלט מבצע יואב 6', address: 'מבצע יואב 6',
    lat: 31.6060874, lon: 34.7517731 },
  { name: 'מקלט מבצע חירם 20', address: 'מבצע חירם 20',
    lat: 31.6066653, lon: 34.75163 },
  { name: 'מקלט מבצע נחשון 23', address: 'מבצע נחשון 23',
    lat: 31.6075179, lon: 34.7515961 },

  // === שבטי ישראל neighborhood ===
  // Municipality data says "מנשה" but Google Maps labels the street "משעול מנשה"
  // Both מנשה 3 and מנשה 6 are on the same short street
  { name: 'מקלט מנשה 3', address: 'מנשה 3',
    lat: 31.6163002, lon: 34.7695483 },
  { name: 'מקלט מנשה 6', address: 'מנשה 6',
    lat: 31.6163002, lon: 34.7695483 },
  // Municipality data says "גד" — OSM has it as "רחבת גד"
  { name: 'מקלט גד 11', address: 'גד 11',
    lat: 31.6166998, lon: 34.7684517 },
  // Municipality data says "יששכר" — OSM has it as "רחבת יששכר"
  { name: 'מקלט יששכר 9', address: 'יששכר 9',
    lat: 31.61613, lon: 34.7704598 },

  // === הר streets ===
  // Municipality data says "התבור" — OSM has it as "מבוא התבור"
  { name: 'מקלט התבור 2', address: 'התבור 2',
    lat: 31.6123431, lon: 34.7741854 },
  // Already geocoded previously
  { name: 'מקלט הגלבוע 10', address: 'הגלבוע 10',
    lat: 31.6125295, lon: 34.7742565 },
];

// Validate all coordinates are in Kiryat Gat area
const LAT_MIN = 31.59, LAT_MAX = 31.63;
const LON_MIN = 34.74, LON_MAX = 34.80;

let allValid = true;
for (const r of results) {
  if (r.lat < LAT_MIN || r.lat > LAT_MAX || r.lon < LON_MIN || r.lon > LON_MAX) {
    console.error(`INVALID: ${r.address} at ${r.lat}, ${r.lon}`);
    allValid = false;
  }
}

if (allValid) {
  console.log('All coordinates validated within Kiryat Gat bounds.\n');
}

// Write output
const outPath = path.join(__dirname, 'kiryat-gat-missing-coords.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');

console.log(`=== ${results.length} Kiryat Gat shelters geocoded ===\n`);
console.log('Address                   Lat          Lon');
console.log('─'.repeat(60));
for (const r of results) {
  console.log(`${r.address.padEnd(25)} ${r.lat.toString().padEnd(12)} ${r.lon}`);
}
console.log(`\nOutput written to: ${outPath}`);
