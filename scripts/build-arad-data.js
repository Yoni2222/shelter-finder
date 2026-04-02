'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const RAW_DATA = [
  // שכ' גבים
  { num:'1',  addr:'אפיק 16',       hood:'גבים' },
  { num:'2',  addr:'אפיק 2',        hood:'גבים' },
  { num:'3',  addr:'אפיק 26',       hood:'גבים' },
  { num:'4',  addr:'אפיק 42',       hood:'גבים' },
  { num:'5',  addr:'אשד 25',        hood:'גבים' },
  { num:'6',  addr:'הבשור 2',       hood:'גבים' },
  { num:'7',  addr:'יובל 40',       hood:'גבים' },
  { num:'8',  addr:'נחל 15',        hood:'גבים' },
  { num:'9',  addr:'נחל 66',        hood:'גבים' },
  { num:'10', addr:'פלג 13',        hood:'גבים' },
  { num:'11', addr:'פלג 22',        hood:'גבים' },
  { num:'12', addr:'פלג 32',        hood:'גבים' },
  // שכ' רותם
  { num:'13', addr:'לשם 5',         hood:'רותם' },
  // שכ' טלים
  { num:'14', addr:'הקנאים 35',     hood:'טלים' },
  { num:'15', addr:'קנאים 39',      hood:'טלים' },
  { num:'16', addr:'קנאים 39',      hood:'טלים' },
  // שכ' יעלים
  { num:'17', addr:'בן יאיר 21',    hood:'יעלים' },
  { num:'18', addr:'חן 3',          hood:'יעלים' },
  { num:'19', addr:'חן 8',          hood:'יעלים' },
  // חצבים/כפרוצ'קה
  { num:'20', addr:'הגלעד 20',      hood:'חצבים' },
  // שכ' נעורים
  { num:'21', addr:'פלמ"ח 19',      hood:'נעורים' },
  { num:'22', addr:'הדס 6',         hood:'נעורים' },
  { num:'23', addr:'הצבי 19',       hood:'נעורים' },
  { num:'24', addr:'הצבי 5',        hood:'נעורים' },
  { num:'25', addr:'מזרח 13',       hood:'נעורים' },
  { num:'26', addr:'מזרח 6',        hood:'נעורים' },
  { num:'27', addr:'נגה 9',         hood:'נעורים' },
  { num:'28', addr:'נורית 14',      hood:'נעורים' },
  { num:'29', addr:'נורית 8',       hood:'נעורים' },
  { num:'30', addr:'ערבה 10',       hood:'נעורים' },
  { num:'31', addr:'ערבה 15',       hood:'נעורים' },
  { num:'32', addr:'ערבה 38',       hood:'נעורים' },
  { num:'33', addr:'פלמ"ח 40',      hood:'נעורים' },
  { num:'34', addr:'פלמ"ח 50',      hood:'נעורים' },
  // שכ' מעוף
  { num:'36', addr:'אגמית 10',      hood:'מעוף' },
  { num:'37', addr:'אגמית 26',      hood:'מעוף' },
  { num:'38', addr:'אנקור 1',       hood:'מעוף' },
  { num:'39', addr:'עיט 13',        hood:'מעוף' },
  { num:'40', addr:'דוכיפת 25',     hood:'מעוף' },
  { num:'41', addr:'דוכיפת 37',     hood:'מעוף' },
  { num:'42', addr:'דוכיפת 42',     hood:'מעוף' },
  { num:'43', addr:'דוכיפת 61',     hood:'מעוף' },
  { num:'44', addr:'זמיר 3',        hood:'מעוף' },
  { num:'45', addr:'זמיר 40',       hood:'מעוף' },
  { num:'46', addr:'זמיר 42',       hood:'מעוף' },
  { num:'47', addr:'לילית 6',       hood:'מעוף' },
  { num:'48', addr:'עגור 5',        hood:'מעוף' },
];

function inBounds(lat, lon) { return lat >= 31.24 && lat <= 31.28 && lon >= 35.19 && lon <= 35.24; }
function geocode(address) {
  const query = `${address}, ערד, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in ערד...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`ערד-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'ערד',neighborhood:e.hood,type:'מקלט ציבורי',source:'gov',category:'public',addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    shelters.push({id:`ערד-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:`מקלט ${o.num}`,address:o.addr,city:'ערד',neighborhood:o.hood,type:'מקלט ציבורי',source:'gov',category:'public',addressEn:''});
  }
  const p=path.join(__dirname,'..','data','arad-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
