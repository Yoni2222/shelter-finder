'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const RAW_DATA = [
  { num:'1',   addr:'הכרמים 100' },
  { num:'2',   addr:'הגורן 17' },
  { num:'3',   addr:'הכרמים 56' },
  { num:'4',   addr:'הכרמים 34' },
  { num:'5',   addr:'היוגב 37' },
  { num:'6',   addr:'הרימון 3' },
  { num:'7',   addr:'בן שמן' },
  { num:'8',   addr:'היוגב 19' },
  { num:'9',   addr:'הזית 1' },
  { num:'10',  addr:'התירוש 3' },
  { num:'11',  addr:'ארבעת המינים 26' },
  { num:'12',  addr:'ערבה 2' },
  { num:'13',  addr:'דיקלה 18' },
  { num:'14',  addr:'הזמורה 9' },
  { num:'15',  addr:'קיבוץ גלויות' },
  { num:'16',  addr:'שרת' },
  { num:'20',  addr:'שרת' },
  { num:'23',  addr:'אבוחצירא 5' },
  { num:'27',  addr:'קרן היסוד' },
  { num:'32',  addr:'קיבוץ גלויות 1407' },
  { num:'33',  addr:'גיבורי ישראל' },
  { num:'36',  addr:'דולומב' },
  { num:'37',  addr:'שרת' },
  { num:'37א', addr:'הרצל' },
  { num:'42',  addr:'הרב קוק' },
  { num:'47',  addr:'הרי"ף' },
  { num:'49',  addr:'הרמב"ם' },
  { num:'51',  addr:'התבור' },
  { num:'52',  addr:'אלישע' },
  { num:'53',  addr:'תשבי' },
  { num:'54',  addr:'חגי 10' },
  { num:'55',  addr:'עמוס 29' },
  { num:'56',  addr:'חנניה 2' },
  { num:'57',  addr:'שמואל הרואה 28' },
  { num:'58',  addr:'אסתר המלכה 7' },
  { num:'59',  addr:'שלמה המלך 38' },
  { num:'60',  addr:'גדעון 18' },
  { num:'61',  addr:'ההגנה' },
  { num:'64',  addr:'הרי"ף 157' },
  { num:'66',  addr:'שמשון 3' },
  { num:'67',  addr:'ישי 43' },
  { num:'69',  addr:'שלמה המלך' },
  { num:'70',  addr:'צדקיהו' },
  { num:'71',  addr:'כרמל' },
  { num:'72',  addr:'שאול המלך 24' },
  { num:'73',  addr:'השילוח 14' },
  { num:'74',  addr:'גלעד 13' },
];

function inBounds(lat, lon) { return lat >= 31.29 && lat <= 31.34 && lon >= 34.60 && lon <= 34.64; }
function geocode(address) {
  const query = `${address}, אופקים, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in אופקים...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`אופקים-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'אופקים',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    shelters.push({id:`אופקים-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:`מקלט ${o.num}`,address:o.addr,city:'אופקים',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:''});
  }
  const p=path.join(__dirname,'..','data','ofakim-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1)});
