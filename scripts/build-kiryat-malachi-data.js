'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const RAW_DATA = [
  { num:'1',  addr:'לוי אשכול 19', hood:'נרקיסים' },
  { num:'2',  addr:'ורדימון 17', hood:'נרקיסים' },
  { num:'3',  addr:'בר יהודה 39', hood:'נרקיסים' },
  { num:'4',  addr:'לוי אשכול 19', hood:'נרקיסים' },
  { num:'5',  addr:'דורי יעקב 1', hood:'יגאל אלון' },
  { num:'6',  addr:'דורי יעקב 14', hood:'יגאל אלון' },
  { num:'7',  addr:'דוד אלעזר 10', hood:'יגאל אלון' },
  { num:'8',  addr:'יקותיאל אדם 58', hood:'יגאל אלון' },
  { num:'9',  addr:'יקותיאל אדם 17', hood:'יגאל אלון' },
  { num:'10', addr:'יצחק שדה 4', hood:'יגאל אלון' },
  { num:'11', addr:'אריה צימוקי 13', hood:'יגאל אלון' },
  { num:'12', addr:'שז"ר 4', hood:'ויצמן' },
  { num:'13', addr:'שז"ר 8', hood:'ויצמן' },
  { num:'14', addr:'בן גוריון 42', hood:'בן גוריון' },
  { num:'15', addr:'עזרא ונחמיה 13', hood:'משה שרת' },
  { num:'16', addr:'משה שרת 3', hood:'משה שרת' },
  { num:'17', addr:'משה שרת 6', hood:'משה שרת' },
  { num:'18', addr:'דוד רזיאל', hood:'דוד רזיאל' },
  { num:'19', addr:'סאן דיאגו 7', hood:'קיבוץ גלויות' },
  { num:'20', addr:'סאן דיאגו 21', hood:'קיבוץ גלויות' },
  { num:'21', addr:'סאן דיאגו 10', hood:'קיבוץ גלויות' },
  { num:'22', addr:'סאן דיאגו 40', hood:'קיבוץ גלויות' },
  { num:'23', addr:'סאן דיאגו 15', hood:'קיבוץ גלויות' },
  { num:'24', addr:'סאן דיאגו 34', hood:'קיבוץ גלויות' },
  { num:'25', addr:'סאן דיאגו 6', hood:'קיבוץ גלויות' },
  { num:'26', addr:'סאן דיאגו 20', hood:'קיבוץ גלויות' },
  { num:'27', addr:'אילת 27', hood:'אילת' },
  { num:'28', addr:'אילת 51', hood:'אילת' },
  { num:'29', addr:'הגולן 1', hood:'הגולן' },
  { num:'30', addr:'הגולן 34', hood:'הגולן' },
  { num:'31', addr:'שבזי 30', hood:'השומרון' },
  { num:'32', addr:'ז\'בוטינסקי 45', hood:'מרכז' },
  { num:'33', addr:'המלאכה 3', hood:'אזור תעשייה' },
  { num:'34', addr:'המלאכה 7', hood:'אזור תעשייה' },
  { num:'35', addr:'עמל 11', hood:'אזור תעשייה' },
  { num:'36', addr:'חרושת 8', hood:'אזור תעשייה' },
  { num:'37', addr:'רש"י 60', hood:'רשי' },
  { num:'38', addr:'הרצל 52', hood:'מרכז' },
  { num:'40', addr:'הגולן 40', hood:'הגולן' },
  { num:'41', addr:'בן גוריון 74', hood:'בן גוריון' },
];

function inBounds(lat, lon) { return lat >= 31.59 && lat <= 31.63 && lon >= 34.72 && lon <= 34.76; }
function geocode(address) {
  const query = `${address}, קריית מלאכי, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in קריית מלאכי...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`קריית-מלאכי-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'קריית מלאכי',neighborhood:e.hood,type:'מקלט ציבורי',source:'gov',category:'public',addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  const p=path.join(__dirname,'..','data','kiryat-malachi-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${oob.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
  if(oob.length)oob.forEach(o=>console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
