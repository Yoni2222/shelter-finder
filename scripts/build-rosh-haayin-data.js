'use strict';
const fs = require('fs'), path = require('path');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

// Source: rh14.maps.arcgis.com webmap item 617f0396bb324839852d0fdc4959383c
// Layer "מקלטים ציבוריים" — geometry is already WGS84 (outSR=4326)
const URL = 'https://services2.arcgis.com/LRSgLpRWTkMT0jqN/arcgis/rest/services/miklat_bh/FeatureServer/0/query';

async function main() {
  console.log('Fetching Rosh HaAyin shelters...');
  const features = await fetchAllArcGIS(URL, {
    outFields: 'FID,Id,num,adress,owne,place,area,הערות,p_max,shcuna,pkey',
  });
  console.log(`Got ${features.length} features`);

  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {}, g = feat.geometry || {};
    // geometry x/y are already WGS84 (outSR=4326 applied)
    const fLon = g.x, fLat = g.y;
    if (!fLat || !fLon) return null;

    const addr = (a.adress || '').trim();
    const place = (a.place || '').trim();
    const shcuna = (a.shcuna || '').trim();
    const notes = (a['הערות'] || '').trim();

    // Determine type label
    let typeLabel = place || 'מקלט ציבורי';
    const isSchool = place.includes('ספר') || notes.includes('ספר');
    const category = isSchool ? 'school' : 'public';

    // Build name
    const name = addr
      ? `מקלט - ${addr}${shcuna ? ' (' + shcuna + ')' : ''}`
      : `מקלט ראש העין #${i + 1}`;

    // Capacity
    const capacity = a.p_max
      ? `${a.p_max} אנשים`
      : (a.area ? `${a.area} מ"ר` : '');

    return {
      id: `roshhaayin_${a.pkey || a.FID || i}`,
      lat: fLat,
      lon: fLon,
      name,
      address: addr,
      city: 'ראש העין',
      capacity,
      type: typeLabel,
      source: 'gov',
      category,
    };
  }).filter(Boolean);

  const out = path.join(__dirname, '..', 'data', 'rosh-haayin-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
