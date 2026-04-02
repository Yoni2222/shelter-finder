'use strict';
/**
 * Build Atlit shelters data from Hof HaCarmel Regional Council list.
 * Source: https://www.hof-hacarmel.co.il/מפת-מקלטים-בחוף-הכרמל/
 *
 * Run: node scripts/build-atlit-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'), path = require('path');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) { console.error('Missing GOOGLE_MAPS_API_KEY in .env'); process.exit(1); }

const CITY = '\u05E2\u05EA\u05DC\u05D9\u05EA';

// Shelters with good addresses (street + number)
const NUMBERED_SHELTERS = [
  [2,  '\u05E1\u05DE\u05D8\u05EA \u05D0\u05DC\u05DE\u05D5\u05D2', '8'],
  [3,  '\u05E1\u05DE\u05D8\u05EA \u05D0\u05DC\u05DE\u05D5\u05D2', '4'],
  [7,  '\u05D4\u05D0\u05E8\u05D6', '5'],
  [9,  '\u05D4\u05D0\u05E8\u05D2\u05DE\u05DF', '34'],
  [10, '\u05D4\u05D0\u05E8\u05D2\u05DE\u05DF', '20'],
  [11, '\u05D4\u05D0\u05E8\u05D2\u05DE\u05DF', '10'],
  [12, '\u05D4\u05D3\u05E7\u05DC', '12'],
  [13, '\u05D4\u05D3\u05E7\u05DC', '6'],
  [14, '\u05DE\u05D7\u05EA\u05E8\u05D5\u05EA', '101'],
  [16, '\u05DE\u05D7\u05EA\u05E8\u05D5\u05EA', '1'],
  [18, '\u05D4\u05E0\u05E8\u05E7\u05D9\u05E1\u05D9\u05DD', '89'],
];

// Shelters with street name only (no number)
const STREET_ONLY_SHELTERS = [
  [1,  '\u05DE\u05E8\u05DB\u05D6 \u05E7\u05D4\u05D9\u05DC\u05EA\u05D9', ''],
  [8,  '\u05D0\u05DC\u05D5\u05DF', ''],
  [15, '\u05D4\u05D1\u05E0\u05D9\u05DD', ''],
  [17, '\u05D4\u05D4\u05E8\u05D3\u05D5\u05E3', ''],
];

// Shelters 24-29 are all on דרך הים - geocode the street once
const DERECH_HAYAM_SHELTERS = [24, 25, 26, 27, 28, 29];

// English fallback map
const EN_FALLBACK = {
  '\u05E1\u05DE\u05D8\u05EA \u05D0\u05DC\u05DE\u05D5\u05D2': 'Simtat Almog',
  '\u05D4\u05D0\u05E8\u05D6': 'HaErez',
  '\u05D4\u05D0\u05E8\u05D2\u05DE\u05DF': 'HaArgaman',
  '\u05D4\u05D3\u05E7\u05DC': 'HaDekel',
  '\u05DE\u05D7\u05EA\u05E8\u05D5\u05EA': 'Makhtarot',
  '\u05D4\u05E0\u05E8\u05E7\u05D9\u05E1\u05D9\u05DD': 'HaNarkisim',
  '\u05DE\u05E8\u05DB\u05D6 \u05E7\u05D4\u05D9\u05DC\u05EA\u05D9': 'Community Center',
  '\u05D0\u05DC\u05D5\u05DF': 'Alon',
  '\u05D4\u05D1\u05E0\u05D9\u05DD': 'HaBanim',
  '\u05D4\u05D4\u05E8\u05D3\u05D5\u05E3': 'HaHarduf',
  '\u05D3\u05E8\u05DA \u05D4\u05D9\u05DD': 'Derech HaYam',
};

async function geocode(address) {
  var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&key=' + API_KEY;
  var r = await fetch(url);
  var data = await r.json();
  if (data.results && data.results.length > 0) {
    var loc = data.results[0].geometry.location;
    var type = data.results[0].geometry.location_type;
    if (type === 'APPROXIMATE') return null;
    return { lat: loc.lat, lon: loc.lng, formatted: data.results[0].formatted_address, type: type };
  }
  return null;
}

async function geocodeWithFallback(street, houseNum) {
  var addrLocal = houseNum ? (street + ' ' + houseNum) : street;
  var fullAddr = addrLocal + ', ' + CITY + ', \u05D9\u05E9\u05E8\u05D0\u05DC';

  var geo = await geocode(fullAddr);
  if (geo) return { geo: geo, addrLocal: addrLocal };

  // Try English fallback
  var enStreet = EN_FALLBACK[street];
  if (enStreet) {
    var enAddr = houseNum
      ? (enStreet + ' ' + houseNum + ', Atlit, Israel')
      : (enStreet + ', Atlit, Israel');
    geo = await geocode(enAddr);
    if (geo) return { geo: geo, addrLocal: addrLocal };
  }

  return { geo: null, addrLocal: addrLocal };
}

async function main() {
  var shelters = [];
  var success = 0, fail = 0;

  // Process numbered shelters
  console.log('=== Numbered Shelters ===');
  for (var i = 0; i < NUMBERED_SHELTERS.length; i++) {
    var num = NUMBERED_SHELTERS[i][0];
    var street = NUMBERED_SHELTERS[i][1];
    var houseNum = NUMBERED_SHELTERS[i][2];
    var result = await geocodeWithFallback(street, houseNum);
    var geo = result.geo;
    var addrLocal = result.addrLocal;
    if (geo) {
      shelters.push({
        id: 'atlit_' + num,
        lat: geo.lat,
        lon: geo.lon,
        name: '\u05DE\u05E7\u05DC\u05D8 ' + num,
        address: street + ' ' + houseNum + ', ' + CITY,
        city: CITY,
        capacity: '',
        type: '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log('  ' + num + ': ' + addrLocal + ' -> ' + geo.lat + ', ' + geo.lon + ' (' + geo.type + ')');
    } else {
      fail++;
      console.log('  X ' + num + ': ' + addrLocal + ' -> FAILED');
    }
    await new Promise(function(r) { setTimeout(r, 50); });
  }

  // Process street-only shelters
  console.log('\n=== Street Only Shelters ===');
  for (var i = 0; i < STREET_ONLY_SHELTERS.length; i++) {
    var num = STREET_ONLY_SHELTERS[i][0];
    var street = STREET_ONLY_SHELTERS[i][1];
    var result = await geocodeWithFallback(street, '');
    var geo = result.geo;
    var addrLocal = result.addrLocal;
    if (geo) {
      shelters.push({
        id: 'atlit_' + num,
        lat: geo.lat,
        lon: geo.lon,
        name: '\u05DE\u05E7\u05DC\u05D8 ' + num,
        address: street + ', ' + CITY,
        city: CITY,
        capacity: '',
        type: '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source: 'gov',
        category: 'public',
        addressEn: geo.formatted,
      });
      success++;
      console.log('  ' + num + ': ' + addrLocal + ' -> ' + geo.lat + ', ' + geo.lon + ' (' + geo.type + ')');
    } else {
      fail++;
      console.log('  X ' + num + ': ' + addrLocal + ' -> FAILED');
    }
    await new Promise(function(r) { setTimeout(r, 50); });
  }

  // Process Derech HaYam shelters (geocode street once)
  console.log('\n=== Derech HaYam Shelters (24-29) ===');
  var dhyResult = await geocodeWithFallback('\u05D3\u05E8\u05DA \u05D4\u05D9\u05DD', '');
  var dhy = dhyResult.geo;
  if (dhy) {
    console.log('  Derech HaYam -> ' + dhy.lat + ', ' + dhy.lon + ' (' + dhy.type + ')');
    for (var j = 0; j < DERECH_HAYAM_SHELTERS.length; j++) {
      var num = DERECH_HAYAM_SHELTERS[j];
      shelters.push({
        id: 'atlit_' + num,
        lat: dhy.lat,
        lon: dhy.lon,
        name: '\u05DE\u05E7\u05DC\u05D8 ' + num,
        address: '\u05D3\u05E8\u05DA \u05D4\u05D9\u05DD, ' + CITY,
        city: CITY,
        capacity: '',
        type: '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source: 'gov',
        category: 'public',
        addressEn: dhy.formatted,
      });
      success++;
    }
  } else {
    fail += DERECH_HAYAM_SHELTERS.length;
    console.log('  X Derech HaYam -> FAILED');
  }

  var total = NUMBERED_SHELTERS.length + STREET_ONLY_SHELTERS.length + DERECH_HAYAM_SHELTERS.length;
  console.log('\nTotal: ' + success + ' geocoded, ' + fail + ' failed out of ' + total);

  var outPath = path.join(__dirname, '..', 'data', 'atlit-shelters.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log('Written to ' + outPath);
}

main().catch(console.error);
