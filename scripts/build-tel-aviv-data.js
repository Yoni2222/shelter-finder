'use strict';
const fs = require('fs'), path = require('path');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

// Note: This is a WKID-2039 MapServer — use where=1=1 with outSR=4326 only (no bbox)
const URL = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/592/query';

async function main() {
  console.log('Fetching Tel Aviv shelters...');
  const features = await fetchAllArcGIS(URL, {
    outFields: 'Full_Address,t_sug,lat,lon,shetach_mr,pail,opening_times,shem,UniqueId,oid_mitkan',
    timeout: 30000
  });
  console.log(`Got ${features.length} features`);
  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {};
    // Prefer attribute lat/lon (WGS84) over geometry (may be ITM-projected)
    let fLat = a.lat, fLon = a.lon;
    if ((!fLat || !fLon) && feat.geometry) { fLon = feat.geometry.x; fLat = feat.geometry.y; }
    if (!fLat || !fLon) return null;
    const addr = a.Full_Address || a.shem || '', type = a.t_sug || 'מקלט ציבורי';
    const isParking = type.includes('חניון');
    return { id: `tlv_${a.UniqueId || a.oid_mitkan || i}`, lat: fLat, lon: fLon, name: addr || `מקלט ת"א #${i+1}`, address: addr, city: 'תל אביב-יפו', capacity: a.shetach_mr ? `${a.shetach_mr} מ"ר` : '', type, hours: a.opening_times || a.pail || '', source: 'gov', category: isParking ? 'parking' : 'public' };
  }).filter(Boolean);
  const out = path.join(__dirname, '..', 'data', 'tel-aviv-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
