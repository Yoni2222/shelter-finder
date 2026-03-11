'use strict';
const fs = require('fs'), path = require('path');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

const URL = 'https://services2.arcgis.com/cjDo9oPmimdHxumn/arcgis/rest/services/%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D/FeatureServer/0/query';

async function main() {
  console.log('Fetching Holon shelters...');
  const features = await fetchAllArcGIS(URL, { outFields: 'OBJECTID,Miklat_Num,ADDRESS,PLACE,USAGE_,area' });
  console.log(`Got ${features.length} features`);
  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {}, g = feat.geometry || {};
    const fLon = g.x, fLat = g.y;
    if (!fLat || !fLon) return null;
    const addr = a.ADDRESS || '', place = a.PLACE || '', usage = a.USAGE_ || '';
    const name = place || (addr ? `מקלט - ${addr}` : `מקלט חולון #${i+1}`);
    return { id: `holon_${a.OBJECTID || i}`, lat: fLat, lon: fLon, name, address: addr, city: 'חולון', capacity: a.area ? `${a.area} מ"ר` : '', type: usage || 'מקלט ציבורי', source: 'gov', category: 'public' };
  }).filter(Boolean);
  const out = path.join(__dirname, '..', 'data', 'holon-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
