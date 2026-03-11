'use strict';
const fs = require('fs'), path = require('path');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

const URL = 'https://services2.arcgis.com/CrAWtmFzBf9b3nM0/arcgis/rest/services/HlsFacilities/FeatureServer/0/query';

async function main() {
  console.log('Fetching Kfar Saba shelters...');
  const features = await fetchAllArcGIS(URL, { outFields: 'OBJECTID,NAME,PLACE,KIND,AREA1,PEOPLE,STR_NAME,SUG,NAME_1' });
  console.log(`Got ${features.length} features`);
  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {}, g = feat.geometry || {};
    const fLon = g.x, fLat = g.y;
    if (!fLat || !fLon) return null;
    const street = a.STR_NAME || '', place = a.NAME_1 || (typeof a.PLACE === 'string' ? a.PLACE : ''), sug = a.SUG || '';
    // KIND is a numeric code: 3=public, etc. — check place name for school
    const isSchool = (typeof place === 'string' && place.includes('בית ספר'));
    const typeLabel = (typeof sug === 'string' && sug.includes('תחתי')) ? 'מקלט תת-קרקעי' : 'מקלט ציבורי';
    const name = place || (street ? `מקלט - ${street}` : `מקלט כפר סבא #${i+1}`);
    return { id: `kfarsaba_${a.OBJECTID || i}`, lat: fLat, lon: fLon, name, address: street, city: 'כפר סבא', capacity: a.PEOPLE ? `${a.PEOPLE} אנשים` : (a.AREA1 ? `${a.AREA1} מ"ר` : ''), type: typeLabel, source: 'gov', category: isSchool ? 'school' : 'public' };
  }).filter(Boolean);
  const out = path.join(__dirname, '..', 'data', 'kfar-saba-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
