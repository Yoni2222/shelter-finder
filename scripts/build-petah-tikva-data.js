'use strict';
const fs = require('fs'), path = require('path');
const fetch = require('node-fetch');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

const ARCGIS_URL = 'https://services9.arcgis.com/tfeLX7LFVABzD11G/arcgis/rest/services/%D7%9E%D7%A8%D7%97%D7%91%D7%99%D7%9D/FeatureServer/0/query';
const MUNI_URL = 'https://www.petah-tikva.muni.il/city-and-municipality/emergency/receivers';

function normaliseAddr(s) {
  return (s || '')
    .replace(/["\u05F3\u05F4]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9 ]/g, '')
    .trim();
}

async function geocode(address) {
  const q = `${address}, פתח תקווה, ישראל`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=il`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ShelterFinderBuild/1.0' }, timeout: 10000 });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeMunicipalPage() {
  console.log('Fetching Petah Tikva municipality page...');
  const res = await fetch(MUNI_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching municipality page`);
  const html = await res.text();

  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) throw new Error('No table found on municipality page');
  const tableHtml = tableMatch[1];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());
    }
    if (cells.length >= 8) rows.push(cells);
  }

  console.log(`Parsed ${rows.length} rows from municipality page`);
  return rows.map(cells => ({
    neighborhood: cells[0],
    street: cells[1],
    buildingCategory: cells[2],
    shelterType: cells[3],
    placeName: cells[4],
    shelterNumber: cells[5],
    quarter: cells[6],
    status: cells[7],
  }));
}

function mapCategory(buildingCategory) {
  const c = buildingCategory || '';
  if (c.includes('בית ספר')) return 'school';
  if (c.includes('גן ילדים')) return 'school';
  return 'public';
}

function mapTypeLabel(buildingCategory, shelterType) {
  const c = buildingCategory || '';
  const t = shelterType || '';
  if (c.includes('בית ספר')) return ('מקלט בית ספרי ' + t).trim();
  if (c.includes('גן ילדים')) return ('מקלט גן ילדים ' + t).trim();
  if (c.includes('מתנ"ס')) return ('מקלט מתנ"ס ' + t).trim();
  if (t.includes('תת')) return 'מקלט תת-קרקעי';
  return ('מרחב מוגן ציבורי ' + t).trim();
}

async function main() {
  console.log('Fetching ArcGIS data...');
  const arcFeatures = await fetchAllArcGIS(ARCGIS_URL, { outFields: 'Address,PlaceName,SUG,complex,OBJECTID,numbermik' });
  console.log(`ArcGIS: ${arcFeatures.length} features`);

  const arcByAddr = new Map();
  const arcByShelterNum = new Map();
  for (const feat of arcFeatures) {
    const a = feat.attributes || {}, g = feat.geometry || {};
    if (!g.y || !g.x) continue;
    const addr = normaliseAddr(a.Address);
    if (addr) arcByAddr.set(addr, { lat: g.y, lon: g.x });
    const num = String(a.numbermik || '').trim();
    if (num) arcByShelterNum.set(num, { lat: g.y, lon: g.x });
  }

  const muniRows = await scrapeMunicipalPage();
  const shelters = [];
  const needGeocode = [];

  for (let i = 0; i < muniRows.length; i++) {
    const row = muniRows[i];
    const normAddr = normaliseAddr(row.street);
    const shelterNum = row.shelterNumber.replace(/[^\d]/g, '');
    const category = mapCategory(row.buildingCategory);
    const typeLabel = mapTypeLabel(row.buildingCategory, row.shelterType);
    let coords = arcByAddr.get(normAddr) || arcByShelterNum.get(shelterNum);

    const name = row.placeName
      ? row.placeName + (row.street ? ' - ' + row.street : '')
      : row.street
        ? 'מקלט - ' + row.street
        : 'מקלט פ"ת #' + (i + 1);

    const shelter = {
      id: 'ptikva_muni_' + (i + 1),
      lat: coords ? coords.lat : null,
      lon: coords ? coords.lon : null,
      name: name,
      address: row.street,
      city: 'פתח תקווה',
      neighborhood: row.neighborhood,
      capacity: '',
      type: typeLabel,
      source: 'gov',
      category: category,
      status: row.status === 'פתוח' ? 'open' : 'closed',
    };

    if (!coords) {
      needGeocode.push({ index: shelters.length, address: row.street });
    }
    shelters.push(shelter);
  }

  console.log('Matched ' + shelters.filter(function(s) { return s.lat; }).length + '/' + shelters.length + ' with ArcGIS coords');
  console.log('Need to geocode: ' + needGeocode.length);

  let geocoded = 0, geocodeFailed = 0;
  for (const item of needGeocode) {
    const result = await geocode(item.address);
    if (result) {
      shelters[item.index].lat = result.lat;
      shelters[item.index].lon = result.lon;
      geocoded++;
    } else {
      geocodeFailed++;
      console.warn('  Geocode failed: "' + item.address + '"');
    }
    await sleep(1100);
  }
  console.log('Geocoded: ' + geocoded + ' success, ' + geocodeFailed + ' failed');

  const valid = shelters.filter(function(s) { return s.lat && s.lon; });
  console.log('Final: ' + valid.length + ' shelters with coordinates (dropped ' + (shelters.length - valid.length) + ')');

  const out = path.join(__dirname, '..', 'data', 'petah-tikva-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(valid, null, 2), 'utf8');
  console.log('Saved ' + valid.length + ' shelters to ' + out);
}

main().catch(function(e) { console.error(e.message); process.exit(1); });
