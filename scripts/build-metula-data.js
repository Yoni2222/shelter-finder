'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// Decoded from reversed-Hebrew PDF
const RAW_DATA = [
  { num:'1',  addr:'מצפה נפתלי 1',   cat:'public' },
  { num:'2',  addr:'מצפה נפתלי 9',   cat:'public' },
  { num:'3',  addr:'מצפה נפתלי 35',  cat:'public' },
  { num:'4',  addr:'מצפה נפתלי 32',  cat:'public' },
  { num:'5',  addr:'מצפה נפתלי',     cat:'public', note:'בית הנוער אולפן חירום' },
  { num:'6',  addr:'מצפה נפתלי 25',  cat:'public' },
  { num:'7',  addr:'מצפה נפתלי 24',  cat:'public', note:'מועדון' },
  { num:'8',  addr:'מצפה נפתלי 28',  cat:'public' },
  { num:'9',  addr:'מצפה החולה 1',   cat:'public' },
  { num:'10', addr:'מצפה החולה 14',  cat:'public' },
  { num:'11', addr:'המעיין 1',       cat:'public' },
  { num:'12', addr:'המעיין 8',       cat:'public' },
  { num:'13', addr:'הגורן 1',        cat:'public' },
  { num:'14', addr:'הגורן 54',       cat:'public' },
  { num:'15', addr:'הראשונים 18',    cat:'public', note:'בית כנסת' },
  { num:'16', addr:'מצפה נפתלי',     cat:'public' },
  { num:'17', addr:'מצפה נפתלי 11',  cat:'public' },
  { num:'18', addr:'הצבעונים 1',     cat:'public' },
  { num:'19', addr:'הראשונים 3',     cat:'public' },
  { num:'20', addr:'הראשונים 15',    cat:'public' },
  { num:'21', addr:'הראשונים 17',    cat:'school', note:'בית האומנויות' },
  { num:'22', addr:'הראשונים 59',    cat:'public', note:'בית הדואר' },
  { num:'23', addr:'הנדיב 6',        cat:'public', note:'גן אורן' },
  { num:'24', addr:'הנדיב 5',        cat:'public', note:'בית הקשיש' },
  { num:'25', addr:'הנדיב 6',        cat:'school', note:'בית הספר' },
  { num:'26', addr:'הנדיב 8',        cat:'school', note:'גנים אלון וארז' },
  { num:'27', addr:'הנדיב 6',        cat:'public' },
  { num:'28', addr:'הנדיב 25',       cat:'public', note:'מלון המבריא' },
  { num:'29', addr:'הארזים 58',      cat:'public' },
  { num:'30', addr:'הארזים 9',       cat:'public' },
  { num:'31', addr:'הארזים 7',       cat:'public' },
  { num:'32', addr:'הלבנון 5',       cat:'public' },
  { num:'33', addr:'הדובדבן 2',      cat:'public' },
  { num:'34', addr:'הדובדבן 13',     cat:'public' },
];

function inBounds(lat, lon) { return lat >= 33.27 && lat <= 33.29 && lon >= 35.57 && lon <= 35.59; }
function geocode(address) {
  const query = `${address}, מטולה, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in מטולה...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{
      const name = e.note ? `מקלט ${e.num} - ${e.note}` : `מקלט ${e.num}`;
      shelters.push({id:`מטולה-${shelters.length+1}`,lat:c.lat,lon:c.lon,name,address:e.addr,city:'מטולה',type:'מקלט ציבורי',source:'gov',category:e.cat,addressEn:c.addressEn||''});
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);
    }
    await sleep(200);
  }
  const p=path.join(__dirname,'..','data','metula-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${oob.length}`);
  if(oob.length)oob.forEach(o=>console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
