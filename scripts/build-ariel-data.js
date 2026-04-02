'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const RAW_DATA = [
  // אזור תעשייה
  { num:'1',  addr:'רחוב העבודה 3',         type:'עילי - נגיש', sqm:25, capacity:20 },
  { num:'2',  addr:'רחוב העבודה 9',         type:'עילי',        sqm:80, capacity:64 },
  { num:'3',  addr:'רחוב המלאכה 6',         type:'תת קרקעי',    sqm:25, capacity:20 },
  { num:'4',  addr:'רחוב המלאכה 3',         type:'תת קרקעי',    sqm:25, capacity:20 },
  // משעול הזית
  { num:'5',  addr:'רחוב משעול הזית 1',     type:'תת קרקעי',    sqm:25, capacity:20 },
  { num:'6',  addr:'רחוב משעול הזית 5',     type:'תת קרקעי',    sqm:25, capacity:20 },
  // הנחשונים
  { num:'7',  addr:'רחוב הנחשונים 57',      type:'תת קרקעי',    sqm:80, capacity:64 },
  { num:'8',  addr:'רחוב הנחשונים 37',      type:'תת קרקעי',    sqm:180, capacity:0 },
  { num:'9',  addr:'רחוב הנחשונים 16',      type:'עילי',        sqm:81, capacity:65 },
  // הדקל
  { num:'10', addr:'רחוב הדקל 25',          type:'עילי',        sqm:81, capacity:65 },
  { num:'11', addr:'רחוב הדקל 37',          type:'עילי',        sqm:81, capacity:65 },
  { num:'12', addr:'רחוב הדקל 70',          type:'עילי',        sqm:81, capacity:65 },
  // האלון / הארז
  { num:'13', addr:'רחוב האלון 9',          type:'עילי',        sqm:81, capacity:65 },
  { num:'14', addr:'רחוב הארז 1',           type:'עילי',        sqm:48, capacity:38 },
  // השקמה
  { num:'15', addr:'רחוב השקמה 1',          type:'עילי',        sqm:63, capacity:50 },
  { num:'16', addr:'רחוב השקמה 4',          type:'עילי',        sqm:149, capacity:119 },
  { num:'17', addr:'רחוב השקמה 8',          type:'עילי',        sqm:149, capacity:119 },
  // הסביונים / גנים
  { num:'18', addr:'רחוב הסביונים 9',       type:'תת קרקעי',    sqm:89, capacity:71 },
  { num:'19', addr:'רחוב גנים 4',           type:'תת קרקעי',    sqm:89, capacity:71 },
  { num:'20', addr:'רחוב גנים 7',           type:'עילי',        sqm:40, capacity:32 },
  { num:'21', addr:'רחוב גנים 23',          type:'עילי',        sqm:50, capacity:40 },
  { num:'22', addr:'רחוב גנים 41',          type:'עילי',        sqm:50, capacity:40 },
  { num:'23', addr:'רחוב גנים 61',          type:'עילי',        sqm:40, capacity:32 },
  // דרך הציונות
  { num:'24', addr:'דרך הציונות 14',        type:'עילי',        sqm:36, capacity:29 },
  { num:'25', addr:'דרך הציונות 18',        type:'עילי',        sqm:36, capacity:29 },
  // צה"ל
  { num:'26', addr:'רחוב צה"ל 8',           type:'עילי',        sqm:60, capacity:48 },
  { num:'27', addr:'רחוב צה"ל 12',          type:'עילי',        sqm:60, capacity:48 },
  // ששת הימים / הנגב
  { num:'28', addr:'רחוב ששת הימים 16',     type:'עילי',        sqm:72, capacity:58 },
  { num:'29', addr:'רחוב הנגב 60',          type:'עילי',        sqm:52, capacity:42 },
  { num:'30', addr:'רחוב הנגב 59',          type:'עילי',        sqm:52, capacity:42 },
];

// Ariel bounding box (approx)
function inBounds(lat, lon) { return lat >= 32.09 && lat <= 32.12 && lon >= 35.15 && lon <= 35.20; }

function geocodeRaw(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geocodeRetry(query, retries=3) {
  for (let a=0;a<retries;a++) {
    try { return await geocodeRaw(query); }
    catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; }
  }
  return null;
}

// Try multiple query variants until we get an in-bounds result
async function geocodeWithFallbacks(addr) {
  // Strip "רחוב " prefix for alternate queries
  const bare = addr.replace(/^רחוב /, '').replace(/^דרך /, '');

  const queries = [
    `${addr}, אריאל, ישראל`,
    `${bare}, אריאל, ישראל`,
    `${bare} אריאל`,
    `${addr} Ariel Israel`,
  ];

  for (const q of queries) {
    const c = await geocodeRetry(q);
    if (c && inBounds(c.lat, c.lon)) return c;
    await sleep(150);
  }
  // Return last result even if OOB (for manual review)
  const last = await geocodeRetry(queries[0]);
  return last ? { ...last, oob: true } : null;
}

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in אריאל...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i];
    const c = await geocodeWithFallbacks(e.addr);
    if(!c) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);
    } else if(c.oob) {
      oob.push({...e,...c});
      console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);
    } else {
      shelters.push({id:`אריאל-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'אריאל',type:'מקלט ציבורי',source:'municipality',category:'public',shelterType:e.type,capacity:e.capacity||0,sqm:e.sqm||0,addressEn:c.addressEn||''});
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);
    }
    await sleep(100);
  }
  // For OOB shelters, DON'T include the clearly-wrong generic fallbacks (31.046)
  // Instead mark them as failures
  for (const o of oob) {
    if (o.lat > 32.0 && o.lat < 32.2) {
      // Plausibly near Ariel even if outside tight box
      shelters.push({id:`אריאל-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:`מקלט ${o.num}`,address:o.addr,city:'אריאל',type:'מקלט ציבורי',source:'municipality',category:'public',shelterType:o.type||'',capacity:o.capacity||0,sqm:o.sqm||0,addressEn:o.addressEn||''});
      console.log(`  Including OOB (near Ariel): ${o.addr} -> (${o.lat}, ${o.lon})`);
    } else {
      failures.push(o);
      console.warn(`  Excluding OOB (far away): ${o.addr} -> (${o.lat}, ${o.lon})`);
    }
  }
  const p=path.join(__dirname,'..','data','ariel-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, Geocoded OK: ${shelters.length}, Failed/excluded: ${failures.length}`);
  if(failures.length) { console.log('Failed addresses:'); failures.forEach(f=>console.log(`  - ${f.addr}`)); }
}
main().catch(e=>{console.error(e.message);process.exit(1)});
