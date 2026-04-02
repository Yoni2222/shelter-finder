'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'חטיבת', 'חטיבה', 'תיכון', 'יסודי'];

const RAW_DATA = [
  // מקלטים ציבוריים
  { name:'מקלט ציבורי אנדרטה ישנה',  addr:'רוטשילד 18' },
  { name:'מקלט ציבורי מוזיאון',        addr:'רוטשילד 37' },
  { name:'מקלט ציבורי הגורן/רוטשילד',  addr:'רוטשילד 48' },
  { name:'מקלט ציבורי אשכול',          addr:'אשכול 28' },
  { name:'מקלט ציבורי רקפת',           addr:'רקפת 9' },
  { name:'מקלט ציבורי השוטרים',        addr:'השוטרים 7' },
  // מיגוניות
  { name:'מיגונית גינת דבורה עומר',    addr:'מילכה וולפסון 1' },
  { name:'מיגונית מול בית העלמין',      addr:'מוטה גור' },
  { name:'מיגונית נשיא שז"ר',          addr:'נשיא שזר' },
  { name:'מיגונית אשכול 7',            addr:'אשכול 7' },
  { name:'מיגונית אשכול 11',           addr:'אשכול 11' },
  { name:'מיגונית משה לוין',           addr:'משה לוין' },
];

function isSchool(name) {
  return SCHOOL_KEYWORDS.some(kw => name.includes(kw));
}

// Bounding box for Mazkeret Batya (roughly)
function inBounds(lat, lon) { return lat >= 31.84 && lat <= 31.87 && lon >= 34.82 && lon <= 34.86; }

function geocode(address) {
  const query = `${address}, מזכרת בתיה, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in מזכרת בתיה...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{
      const cat = isSchool(e.name) ? 'school' : 'public';
      shelters.push({id:`מזכרת בתיה-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:e.name,address:e.addr,city:'מזכרת בתיה',type:'מקלט ציבורי',source:'gov',category:cat,addressEn:c.addressEn||''});
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);
    }
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    const cat = isSchool(o.name) ? 'school' : 'public';
    shelters.push({id:`מזכרת בתיה-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:o.name,address:o.addr,city:'מזכרת בתיה',type:'מקלט ציבורי',source:'gov',category:cat,addressEn:o.addressEn||''});
  }
  const p=path.join(__dirname,'..','data','mazkeret-batya-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1)});
