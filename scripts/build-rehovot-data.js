'use strict';
const fs = require('fs'), path = require('path');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

const URL = 'https://services6.arcgis.com/U71MeVnZSuYULYvK/arcgis/rest/services/%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D_%D7%A2%D7%9D_%D7%9B%D7%9C%D7%91%D7%99%D7%90_view/FeatureServer/0/query';

async function main() {
  console.log('Fetching Rehovot shelters...');
  const features = await fetchAllArcGIS(URL, { outFields: 'OBJECTID,MIKLAT_ID,NAME,STREET,HOUSE_N,area,sug' });
  console.log(`Got ${features.length} features`);
  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {}, g = feat.geometry || {};
    const fLon = g.x, fLat = g.y;
    if (!fLat || !fLon) return null;
    const street = a.STREET || '', houseN = a.HOUSE_N != null ? String(a.HOUSE_N) : '';
    const addr = [street, houseN].filter(Boolean).join(' '), sug = a.sug || '';
    const isSchool = sug.includes('בית ספר');
    const name = a.NAME || (addr ? `מקלט - ${addr}` : `מקלט רחובות #${i+1}`);
    return { id: `rehovot_${a.OBJECTID || a.MIKLAT_ID || i}`, lat: fLat, lon: fLon, name, address: addr, city: 'רחובות', capacity: a.area ? `${a.area} מ"ר` : '', type: isSchool ? 'מקלט בית ספרי' : 'מקלט ציבורי', source: 'gov', category: isSchool ? 'school' : 'public' };
  }).filter(Boolean);
  const out = path.join(__dirname, '..', 'data', 'rehovot-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
