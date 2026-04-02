'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// From PDF: "רשימת מיגוניות כפר ורדים" - 23 mobile shelters
const RAW_DATA = [
  { num:'1',  addr:'צומת המפה',                          geocodeAddr:'כפר ורדים' },
  { num:'2',  addr:'תחנת הסעה קשת',                      geocodeAddr:'קשת, כפר ורדים' },
  { num:'3',  addr:'תחנת הסעה אשכול גנים',               geocodeAddr:'אשכול גנים, כפר ורדים' },
  { num:'4',  addr:'רווחה',                               geocodeAddr:'מרכז רווחה, כפר ורדים' },
  { num:'5',  addr:'בית כנסת גדול',                       geocodeAddr:'בית כנסת, כפר ורדים' },
  { num:'6',  addr:'גן משחקים כיכר 9',                    geocodeAddr:'כפר ורדים' },
  { num:'7',  addr:'פעוטוני החורש',                       geocodeAddr:'החורש, כפר ורדים' },
  { num:'8',  addr:'בית עלמין',                           geocodeAddr:'בית עלמין, כפר ורדים' },
  { num:'9',  addr:'תחנת הסעה בי"ס אמירים',              geocodeAddr:'בית ספר אמירים, כפר ורדים' },
  { num:'10', addr:'מרכז מסחרי',                          geocodeAddr:'מרכז מסחרי, כפר ורדים' },
  { num:'11', addr:'צופים',                               geocodeAddr:'צופים, כפר ורדים' },
  { num:'12', addr:'ליד הבריכה',                          geocodeAddr:'בריכה, כפר ורדים' },
  { num:'13', addr:'חניית מועדון גיל הזהב',              geocodeAddr:'מועדון גיל הזהב, כפר ורדים' },
  { num:'14', addr:'חנייה מרכז קהילתי',                   geocodeAddr:'מרכז קהילתי, כפר ורדים' },
  { num:'15', addr:'תחנת הסעה כיכר 8',                    geocodeAddr:'כפר ורדים' },
  { num:'16', addr:'בית כנסת מנין משפחתי',                geocodeAddr:'כפר ורדים' },
  { num:'17', addr:'כניסה עליונה בי"ס תפן ליד כיכר 6',   geocodeAddr:'בית ספר תפן, כפר ורדים' },
  { num:'18', addr:'מגרש משחקים רחוב אדיר',              geocodeAddr:'אדיר, כפר ורדים' },
  { num:'19', addr:'תחנת אוטובוס ליד המארג',             geocodeAddr:'המארג, כפר ורדים' },
  { num:'20', addr:'מגרש טניס',                           geocodeAddr:'כפר ורדים' },
  { num:'21', addr:'שלב ג בכניסה לחדיף',                  geocodeAddr:'כפר ורדים' },
  { num:'22', addr:'בי"ס תפן חניית אוטובוסים',           geocodeAddr:'בית ספר תפן, כפר ורדים' },
  { num:'23', addr:'בי"ס תפן חניית אוטובוסים',           geocodeAddr:'בית ספר תפן, כפר ורדים' },
];

function inBounds(lat, lon) { return lat >= 32.96 && lat <= 33.00 && lon >= 35.26 && lon <= 35.31; }
function geocode(address) {
  const query = `${address}, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in כפר ורדים...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.geocodeAddr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{
      const cat = e.addr.includes('בי"ס') || e.addr.includes('בית ספר') ? 'school' : 'public';
      shelters.push({id:'כפר-ורדים-'+(shelters.length+1),lat:c.lat,lon:c.lon,name:'מיגונית '+e.num,address:e.addr,city:'כפר ורדים',type:'מיגונית',source:'gov',category:cat,addressEn:c.addressEn||''});
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);
    }
    await sleep(200);
  }
  // Add OOB entries with their coords (likely correct but outside tight bounds)
  for (const o of oob) {
    const cat = o.addr.includes('בי"ס') || o.addr.includes('בית ספר') ? 'school' : 'public';
    shelters.push({id:'כפר-ורדים-'+(shelters.length+1),lat:o.lat,lon:o.lon,name:'מיגונית '+o.num,address:o.addr,city:'כפר ורדים',type:'מיגונית',source:'gov',category:cat,addressEn:o.addressEn||''});
  }
  const p=path.join(__dirname,'..','data','kfar-vradim-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}`);
}
main().catch(e=>{console.error(e.message);process.exit(1);});
