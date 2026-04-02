'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const RAW_DATA = [
  { num:'1',  addr: 'האתרוג',        geocodeAddr: 'האתרוג',        note: 'בצמוד לבניין המועצה' },
  { num:'2',  addr: 'הדס 12',        geocodeAddr: 'הדס 12',        note: 'גן שגיא' },
  { num:'3',  addr: 'האלון',         geocodeAddr: 'האלון',         note: 'גן הנופלים' },
  { num:'4',  addr: 'הארז 24',       geocodeAddr: 'הארז 24',       note: '' },
  { num:'5',  addr: 'הארז',          geocodeAddr: 'הארז',          note: 'מתנ"ס' },
  { num:'9',  addr: 'סמטת התמר',     geocodeAddr: 'סמטת התמר',     note: 'ליד קיר טיפוס' },
  { num:'10', addr: 'סמטת תאנה',     geocodeAddr: 'סמטת תאנה',     note: '' },
  { num:'11', addr: 'האלון 93',      geocodeAddr: 'האלון 93',      note: '' },
  { num:'12', addr: 'האלון 72',      geocodeAddr: 'האלון 72',      note: '' },
  { num:'13', addr: 'האלון 61',      geocodeAddr: 'האלון 61',      note: 'בית כנסת זכות אבות' },
  { num:'14', addr: 'האלון 36',      geocodeAddr: 'האלון 36',      note: '' },
  { num:'15', addr: 'מעלה לבונה',    geocodeAddr: 'מעלה לבונה',    note: '' },
  { num:'16', addr: 'האלון',         geocodeAddr: 'האלון',         note: 'גן חנן' },
  { num:'18', addr: 'הנרקיסים',      geocodeAddr: 'הנרקיסים',      note: 'אולם ספורט' },
];

function inBounds(lat, lon) { return lat >= 32.69 && lat <= 32.72 && lon >= 35.13 && lon <= 35.17; }
function geocode(address) {
  const query = `${address}, רמת ישי, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in רמת ישי...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.geocodeAddr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`רמת-ישי-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'רמת ישי',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  const p=path.join(__dirname,'..','data','ramat-yishai-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${oob.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
  if(oob.length)oob.forEach(o=>console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
