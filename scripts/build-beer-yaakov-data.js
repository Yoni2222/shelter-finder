'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// From municipality PDF (reversed Hebrew decoded)
const RAW_DATA = [
  // Public shelters (page 3)
  { num:'4', addr:'הגפן',           cat:'public' },
  { num:'7', addr:'הרב קוק',       cat:'public' },
  { num:'8', addr:'חזון איש',      cat:'public' },
  { num:'6', addr:'האיריס',        cat:'public' },
  { num:'5', addr:'החבצלת',        cat:'public' },
  { num:'3', addr:'האורן',         cat:'public' },
  { num:'2', addr:'ז\'בוטינסקי',   cat:'public' },
  { num:'9', addr:'תלמי מנשה',     cat:'public' },
  // School shelters (page 4)
  { num:'ק1', addr:'אש נס 17',              cat:'school' },
  { num:'ק2', addr:'שבטי 2',                cat:'school' },
  { num:'ק3', addr:'שלמה בן יוסף 22',       cat:'school' },
  { num:'ק4', addr:'לאה גולדברג 1',         cat:'school' },
  // Miguniyot (pages 1-2)
  { num:'מ1',  addr:'נחום 7',                           cat:'public' },
  { num:'מ2',  addr:'נחום 9',                           cat:'public' },
  { num:'מ3',  addr:'אבא הלל סילבר 5',                 cat:'public' },
  { num:'מ4',  addr:'האורן 6',                          cat:'public' },
  { num:'מ5',  addr:'קרן היסוד 10',                     cat:'public' },
  { num:'מ6',  addr:'רבי מאיר בעל הנס 3',              cat:'public' },
  { num:'מ7',  addr:'התאנה 8',                          cat:'public' },
  { num:'מ8',  addr:'קרן היסוד 33',                     cat:'public' },
  { num:'מ9',  addr:'יהודה 1',                          cat:'public' },
  { num:'מ10', addr:'דובדבן 4',             geocodeCity:'תלמי מנשה', cat:'public' },
  { num:'מ11', addr:'הדר 26',               geocodeCity:'תלמי מנשה', cat:'public' },
  { num:'מ12', addr:'אקליפטוס',                         cat:'public' },
  { num:'מ13', addr:'החבצלת 1',                         cat:'public' },
  { num:'מ14', addr:'הרב עוזיאל 22',                    cat:'public' },
  { num:'מ15', addr:'התבור 10',                         cat:'public' },
  { num:'מ16', addr:'אילה 35',                          cat:'public' },
  { num:'מ17', addr:'אילה 18',                          cat:'public' },
];

function inBounds(lat, lon) { return lat >= 31.92 && lat <= 31.96 && lon >= 34.82 && lon <= 34.86; }
function geocode(address, city) {
  city = city || 'באר יעקב';
  const query = `${address}, ${city}, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, city, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr, city); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in באר יעקב...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i];
    const city = e.geocodeCity || 'באר יעקב';
    const c=await geocodeRetry(e.addr, city);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else {
      // Wider bounds for תלמי מנשה entries
      const ok = e.geocodeCity ? true : inBounds(c.lat,c.lon);
      if(!ok){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
      else{shelters.push({id:`באר-יעקב-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'באר יעקב',type:'מקלט ציבורי',source:'gov',category:e.cat,addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    }
    await sleep(200);
  }
  const p=path.join(__dirname,'..','data','beer-yaakov-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${oob.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
  if(oob.length)oob.forEach(o=>console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
