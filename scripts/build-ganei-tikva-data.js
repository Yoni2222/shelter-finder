'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const RAW_DATA = [
  // מרחבים מוגנים במבני ציבור - מאתר עיריית גני תקווה
  { addr:'דרך הים 9',         name:'ממ"ד חטיבת הביניים הראשונים' },
  { addr:'דרך הים 9',         name:'בית הספר אילות' },
  { addr:'דרך הים 3',         name:'בית הספר יובלים' },
  { addr:'דרך המשי 9',        name:'בית הספר אמירים' },
  { addr:'הגליל 31',          name:'בית הספר בית יעקב' },
  { addr:'התבור 10',          name:'בית הספר רביבים' },
  { addr:'הגליל 22',          name:'בית הספר גנים' },
  { addr:'הרי יהודה 28',      name:'בית ספר אריאל' },
  { addr:'הקישון 20',         name:'אגף החינוך' },
  { addr:'עמק זבולון',        name:'מקלט ליד אנדרטת הנופלים' },
  { addr:'הנגב 9',            name:'מתחם קהילתי הנגב' },
  { addr:'הכרמל 1',           name:'קאנטרי גלים' },
  { addr:'הערבה',              name:'מקלט הערבה/הדקל' },
  { addr:'עין גדי',            name:'מקלט עין גדי' },
  { addr:'מרחביה 1',          name:'מקלט מרחביה' },
  { addr:'התבור',              name:'מקלט התבור (ליד ביה"ס רביבים)' },
  { addr:'הגליל 33',          name:'מבנה רווחה' },
  { addr:'הנגב',               name:'מקלט הנגב/כנרת' },
  { addr:'הכרמל',              name:'מרכז מסחרי הבמה' },
];

// Ganei Tikva bounding box (approx 32.055-32.075 lat, 34.855-34.885 lon)
function inBounds(lat, lon) { return lat >= 32.05 && lat <= 32.08 && lon >= 34.85 && lon <= 34.89; }
function geocode(address) {
  const query = `${address}, גני תקווה, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in גני תקווה...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`גני-תקווה-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:e.name,address:e.addr,city:'גני תקווה',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Include OOB shelters (bounding box may be too tight)
  for (const o of oob) {
    shelters.push({id:`גני-תקווה-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:o.name,address:o.addr,city:'גני תקווה',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:o.addressEn||''});
  }
  const p=path.join(__dirname,'..','data','ganei-tikva-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
