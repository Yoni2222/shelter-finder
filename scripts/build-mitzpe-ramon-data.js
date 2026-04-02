'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// Source: https://mitzpe-ramon.muni.il/תושבים/מקלטים/
const RAW_DATA = [
  { addr:'הר ארדון 6',          desc:'' },
  { addr:'הר ארדון 8',          desc:'' },
  { addr:'הר בוקר 10',          desc:'' },
  { addr:'הר בוקר 12',          desc:'' },
  { addr:'הר בוקר 4',           desc:'' },
  { addr:'נחל איילות 29',       desc:'לא שמיש בעקבות שריפה' },
  { addr:'נחל גרופית 10',       desc:'' },
  { addr:'נחל גרופית 11',       desc:'נחל האלה 2' },
  { addr:'נחל האלה 3',          desc:'' },
  { addr:'נחל חמדה 40',         desc:'מו"פ מדבר' },
  { addr:'נחל טרשים 10',        desc:'' },
  { addr:'נחל כרכום 3',         desc:'' },
  { addr:'נחל מישר 10',         desc:'' },
  { addr:'נחל ערבה 3',          desc:'אור לעולם' },
  { addr:'נחל ציחור 10',        desc:'ביגודית' },
  { addr:'נחל צניפים 10',       desc:'' },
  { addr:'נחל רעים 6',          desc:'בית כנסת' },
  { addr:'נחל רעף 8',           desc:'בית כנסת' },
  { addr:'עין משק 10',          desc:'' },
  { addr:'עין משק 18',          desc:'' },
  { addr:'עין משק 22',          desc:'' },
  { addr:'עין משק 26',          desc:'' },
  { addr:'עין משק 28',          desc:'' },
  { addr:'עין שביב 51',         desc:'מו"פ מדבר' },
  { addr:'עין שחק 21',          desc:'' },
  { addr:'עין שחק 8',           desc:'' },
  { addr:'שד\' בן גוריון 4',    desc:'מיגונית בנק הפועלים (זמני)' },
  { addr:'שד\' בן גוריון 6א',   desc:'אמפיתאטרון' },
];

const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'חטיבת', 'חטיבה', 'תיכון', 'יסודי'];

function isSchool(name, desc) {
  const combined = `${name} ${desc}`.toLowerCase();
  return SCHOOL_KEYWORDS.some(kw => combined.includes(kw));
}

// Mitzpe Ramon bounding box (approx)
function inBounds(lat, lon) { return lat >= 30.59 && lat <= 30.63 && lon >= 34.78 && lon <= 34.83; }

function geocode(address) {
  const query = `${address}, מצפה רמון, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in מצפה רמון...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    const name = e.desc ? `מקלט – ${e.desc}` : 'מקלט ציבורי';
    const category = isSchool(name, e.desc) ? 'school' : 'public';
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c,name,category});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`מצפה רמון-${shelters.length+1}`,lat:c.lat,lon:c.lon,name,address:e.addr,city:'מצפה רמון',type:'מקלט ציבורי',source:'gov',category,addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    shelters.push({id:`מצפה רמון-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:o.name,address:o.addr,city:'מצפה רמון',type:'מקלט ציבורי',source:'gov',category:o.category,addressEn:''});
  }
  const p=path.join(__dirname,'..','data','mitzpe-ramon-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
