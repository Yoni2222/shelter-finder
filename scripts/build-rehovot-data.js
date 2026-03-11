'use strict';
const fs = require('fs'), path = require('path');
const fetch = require('node-fetch');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

const ARCGIS_URL = 'https://services6.arcgis.com/U71MeVnZSuYULYvK/arcgis/rest/services/%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D_%D7%A2%D7%9D_%D7%9B%D7%9C%D7%91%D7%99%D7%90_view/FeatureServer/0/query';
const MUNI_URL = 'https://www.rehovot.muni.il/%D7%A8%D7%A9%D7%99%D7%9E%D7%AA-%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D-%D7%91%D7%A2%D7%99%D7%A8-%D7%A8%D7%97%D7%95%D7%91%D7%95%D7%AA/';

async function geocode(address) {
  const q = address + ', רחובות, ישראל';
  const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=1&countrycodes=il';
  const res = await fetch(url, { headers: { 'User-Agent': 'ShelterFinderBuild/1.0' }, timeout: 10000 });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalise(s) {
  return (s || '').replace(/[\u05F3\u05F4"']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseRehovotPage(html) {
  const tables = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tm;
  while ((tm = tableRe.exec(html)) !== null) {
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let rm;
    while ((rm = rowRe.exec(tm[1])) !== null) {
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cm;
      while ((cm = cellRe.exec(rm[1])) !== null) {
        let text = cm[1].replace(/<span[^>]*class="mobile-caption"[^>]*>[\s\S]*?<\/span>/gi, '');
        text = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        cells.push(text);
      }
      if (cells.length >= 2) rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}

async function main() {
  console.log('Fetching ArcGIS data...');
  const arcFeatures = await fetchAllArcGIS(ARCGIS_URL, { outFields: 'OBJECTID,MIKLAT_ID,NAME,STREET,HOUSE_N,sug,area' });
  console.log('ArcGIS: ' + arcFeatures.length + ' features');

  const arcByShelterNum = new Map();
  const arcByName = new Map();
  for (const feat of arcFeatures) {
    const a = feat.attributes || {}, g = feat.geometry || {};
    if (!g.y || !g.x) continue;
    const numMatch = (a.NAME || '').match(/מקלט\s*(\d+)/);
    if (numMatch) arcByShelterNum.set(numMatch[1], { lat: g.y, lon: g.x, attrs: a });
    const normName = normalise(a.NAME);
    if (normName) arcByName.set(normName, { lat: g.y, lon: g.x, attrs: a });
  }

  console.log('Fetching Rehovot municipality page...');
  const res = await fetch(MUNI_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const html = await res.text();
  const tables = parseRehovotPage(html);
  console.log('Found ' + tables.length + ' tables');

  const shelters = [];
  const needGeocode = [];

  // Table 0: Public shelters - [index, shelterNum/name, street, houseNum]
  if (tables[0]) {
    console.log('Public shelters: ' + tables[0].length + ' rows');
    for (let i = 0; i < tables[0].length; i++) {
      const row = tables[0][i];
      const shelterNum = row[1] || '';
      const street = row[2] || '';
      const houseNum = row[3] || '';
      const addr = street + (houseNum ? ' ' + houseNum : '');
      const numOnly = shelterNum.replace(/[^\d]/g, '');

      const coords = arcByShelterNum.get(numOnly);

      const name = numOnly
        ? 'מקלט ' + numOnly + (street ? ' - ' + street : '')
        : (shelterNum || 'מקלט רחובות #' + (i + 1));

      shelters.push({
        id: 'rehovot_pub_' + (i + 1),
        lat: coords ? coords.lat : null,
        lon: coords ? coords.lon : null,
        name,
        address: addr,
        city: 'רחובות',
        capacity: (coords && coords.attrs.area) ? coords.attrs.area + ' מ"ר' : '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
      });
      if (!coords) needGeocode.push({ index: shelters.length - 1, address: addr });
    }
  }

  // Table 1: School shelters - [name, street, houseNum]
  if (tables[1]) {
    console.log('School shelters: ' + tables[1].length + ' rows');
    for (let i = 0; i < tables[1].length; i++) {
      const row = tables[1][i];
      const placeName = row[0] || '';
      const street = row[1] || '';
      const houseNum = row[2] || '';
      const addr = street + (houseNum ? ' ' + houseNum : '');

      let coords = arcByName.get(normalise(placeName));
      if (!coords) {
        for (const [k, v] of arcByName) {
          if (k.includes(normalise(placeName)) || normalise(placeName).includes(k)) {
            coords = v;
            break;
          }
        }
      }

      shelters.push({
        id: 'rehovot_sch_' + (i + 1),
        lat: coords ? coords.lat : null,
        lon: coords ? coords.lon : null,
        name: placeName + (addr ? ' - ' + addr : ''),
        address: addr,
        city: 'רחובות',
        capacity: (coords && coords.attrs && coords.attrs.area) ? coords.attrs.area + ' מ"ר' : '',
        type: 'מקלט בית ספרי',
        source: 'gov',
        category: 'school',
      });
      if (!coords) needGeocode.push({ index: shelters.length - 1, address: addr });
    }
  }

  // Table 2: Migoniyot - [index, location, address, accessible]
  if (tables[2]) {
    console.log('Migoniyot: ' + tables[2].length + ' rows');
    for (let i = 0; i < tables[2].length; i++) {
      const row = tables[2][i];
      const location = row[1] || '';
      const addr = row[2] || '';

      shelters.push({
        id: 'rehovot_mig_' + (i + 1),
        lat: null,
        lon: null,
        name: location + (addr ? ' - ' + addr : ''),
        address: addr,
        city: 'רחובות',
        capacity: '',
        type: 'מיגונית',
        source: 'gov',
        category: 'public',
      });
      needGeocode.push({ index: shelters.length - 1, address: addr });
    }
  }

  console.log('Matched ' + shelters.filter(s => s.lat).length + '/' + shelters.length + ' with ArcGIS coords');
  console.log('Need to geocode: ' + needGeocode.length);

  let geocoded = 0, failed = 0;
  for (const item of needGeocode) {
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
  console.log('Final: ' + valid.length + ' shelters (dropped ' + (shelters.length - valid.length) + ')');

  const out = path.join(__dirname, '..', 'data', 'rehovot-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(valid, null, 2), 'utf8');
  console.log('Saved ' + valid.length + ' shelters to ' + out);
}

main().catch(e => { console.error(e.message); process.exit(1); });
