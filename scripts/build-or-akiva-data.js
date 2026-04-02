'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// Decoded from reversed-Hebrew PDF
const RAW_DATA = [
  { num:'1',  addr: 'הנשיא פינת חיי טייב',        geocodeAddr: 'הנשיא' },
  { num:'2',  addr: 'יחיאל וייסנברג',              geocodeAddr: 'וייסנברג' },
  { num:'3',  addr: 'הנשיא פינת סטנלי מאיר 1',     geocodeAddr: 'הנשיא' },
  { num:'4',  addr: 'הרצל',                         geocodeAddr: 'הרצל' },
  { num:'5',  addr: 'איחוד העם 9',                  geocodeAddr: 'איחוד העם 9' },
  { num:'6',  addr: 'בלפור גן המייסדים',            geocodeAddr: 'בלפור' },
  { num:'7',  addr: 'הרצל פינת ביאליק 6',           geocodeAddr: 'הרצל 6' },
  { num:'8',  addr: 'ביאליק פינת מנחם חכם',         geocodeAddr: 'ביאליק' },
  { num:'9',  addr: 'הנביאים 6',                    geocodeAddr: 'הנביאים 6' },
  { num:'10', addr: 'הנביאים 7',                    geocodeAddr: 'הנביאים 7' },
  { num:'11', addr: 'בין הרב קוק לז\'בוטינסקי',    geocodeAddr: 'הרב קוק' },
  { num:'12', addr: 'חללי דק"ר 648',               geocodeAddr: 'חללי דקר' },
  { num:'13', addr: 'גני אור ניל"י 13',            geocodeAddr: 'נילי 13' },
  { num:'14', addr: 'גני אור ניל"י 33',            geocodeAddr: 'נילי 33' },
  { num:'15', addr: 'גני אור ניל"י 58',            geocodeAddr: 'נילי 58' },
  { num:'16', addr: 'גני אור ניל"י 98',            geocodeAddr: 'נילי 98' },
  { num:'17', addr: 'הורד 37',                     geocodeAddr: 'הורד 37' },
  { num:'18', addr: 'התאנה 4',                     geocodeAddr: 'התאנה 4' },
  { num:'19', addr: 'האירוס 36',                   geocodeAddr: 'האירוס 36' },
  { num:'20', addr: 'האירוס 63',                   geocodeAddr: 'האירוס 63' },
  { num:'21', addr: 'הנרקיס 36',                   geocodeAddr: 'הנרקיס 36' },
  { num:'22', addr: 'הנרקיס 8',                    geocodeAddr: 'הנרקיס 8' },
  { num:'23', addr: 'היסמין 63',                   geocodeAddr: 'היסמין 63' },
];

function inBounds(lat, lon) { return lat >= 32.49 && lat <= 32.52 && lon >= 34.91 && lon <= 34.94; }
function geocode(address) {
  const query = `${address}, אור עקיבא, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in אור עקיבא...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.geocodeAddr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`אור-עקיבא-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'אור עקיבא',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Include OOB
  for (const o of oob) {
    shelters.push({id:`אור-עקיבא-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:`מקלט ${o.num}`,address:o.addr,city:'אור עקיבא',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:''});
  }
  const p=path.join(__dirname,'..','data','or-akiva-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK: ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
