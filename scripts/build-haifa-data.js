'use strict';
/**
 * Fetches all Haifa shelters from the official municipality GIS API
 * and saves them as a static JSON file: data/haifa-shelters.json
 *
 * Run: node scripts/build-haifa-data.js
 * Re-run periodically to refresh the data (e.g. every few months).
 */

const fetch = require('node-fetch');
const fs    = require('fs');
const path  = require('path');

const HAIFA_GIS_URL =
  'https://gisserver.haifa.muni.il/arcgiswebadaptor/rest/services/' +
  'PublicSite/Haifa_Sec_Public/MapServer/1/query';

async function main() {
  console.log('Fetching all Haifa shelters from municipal GIS...');

  const params = new URLSearchParams({
    where:             '1=1',
    outFields:         'Migun_FullAddress,Migun_Name,Migun_Type,QtyPeople,Migun_Area,Neighborhood,OBJECTID',
    outSR:             '4326',
    returnGeometry:    'true',
    resultRecordCount: '2000',
    f:                 'json',
  });

  const res = await fetch(`${HAIFA_GIS_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 20000,
  });

  if (!res.ok) throw new Error(`GIS server returned HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`GIS error: ${json.error.message}`);

  const features = json.features || [];
  console.log(`Got ${features.length} features from GIS`);

  const shelters = features.map((feat, i) => {
    const a    = feat.attributes || {};
    const g    = feat.geometry   || {};
    const fLon = g.x;
    const fLat = g.y;
    if (!fLat || !fLon) return null;

    const migunType = a.Migun_Type || '';
    const isParking = migunType.includes('חניון');
    const isSchool  = migunType.includes('ספר');

    // Strip invisible Unicode direction marks and non-breaking spaces
    const clean = s => (s || '').replace(/[\u200E\u200F\u00A0]/g, '').trim();
    const addr    = clean(a.Migun_FullAddress);
    const rawName = clean(a.Migun_Name);
    const isNumericOnly = /^\d+$/.test(rawName);

    let name;
    if (rawName && !isNumericOnly) name = rawName;
    else if (addr)                 name = 'מקלט חיפה - ' + addr;
    else                           name = 'מקלט חיפה #' + (i + 1);

    return {
      id:       'haifa_' + a.OBJECTID,
      lat:      fLat,
      lon:      fLon,
      name,
      address:  addr,
      city:     'חיפה',
      capacity: a.QtyPeople
        ? a.QtyPeople + ' אנשים'
        : (a.Migun_Area ? a.Migun_Area + ' מ"ר' : ''),
      type:     migunType || 'מקלט ציבורי',
      source:   'gov',
      category: isParking ? 'parking' : (isSchool ? 'school' : 'public'),
    };
  }).filter(Boolean);

  console.log(`Processed ${shelters.length} valid shelters`);

  const outPath = path.join(__dirname, '..', 'data', 'haifa-shelters.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved to ${outPath}`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
