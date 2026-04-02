'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// From municipality website table (two-column layout)
const RAW_DATA = [
  // Right column (green)
  { num:'1',  addr:'ביאליק 4',         note:'מועדונית פרחים' },
  { num:'2',  addr:'ביאליק 13',        note:'בית כנסת שאגת אריה' },
  { num:'3',  addr:'ביאליק 29',        note:'שיפור עירוני' },
  { num:'4',  addr:'בן צבי 7',         note:'' },
  { num:'5',  addr:'בן צבי 10',        note:'מחסה' },
  { num:'6',  addr:'בן צבי 24',        note:'מחסה' },
  { num:'7',  addr:'בן צבי 38',        note:'' },
  { num:'8',  addr:'גיורא 55',         note:'' },
  { num:'9',  addr:'האלה 14',          note:'בית כנסת יד אליהו ומרדכי' },
  { num:'10', addr:'הגורדים 5',         note:'בי"ס דגניה אולם ספורט' },
  { num:'11', addr:'הגורדים 11',        note:'' },
  { num:'12', addr:'הכלנית 20',         note:'בי"ס אפרים פנח אולם ספורט' },
  { num:'13', addr:'הרב ויינרב 9',      note:'מועדונית בן צבי' },
  { num:'14', addr:'הרב ויינרב 28',     note:'מרכז הפעלה' },
  { num:'15', addr:'הרב ויינרב 39',     note:'' },
  { num:'16', addr:'הרב קוק 6',         note:'בי"ס זבולון' },
  { num:'17', addr:'הרב קוק 23',        note:'בית כנסת שיר למעלות' },
  { num:'18', addr:'הרב קוק 31',        note:'' },
  { num:'19', addr:'לוי אשכול 6',       note:'מוקד עירוני' },
  // Left column (teal)
  { num:'20', addr:'הרצל 39',           note:'קניון לב העיר' },
  { num:'21', addr:'ויצמן 19',          note:'בי"ס יגאל אלון' },
  { num:'22', addr:'ויצמן 71',          note:'אגף הרווחה' },
  { num:'23', addr:'ז\'בוטינסקי 7',     note:'בית כנסת מעיין חיים' },
  { num:'24', addr:'ז\'בוטינסקי 43',    note:'מתנ"ס' },
  { num:'25', addr:'ירושלים 3',         note:'מועדונית פרפרים' },
  { num:'26', addr:'ירושלים 18',        note:'בית כנסת משכן אליון' },
  { num:'27', addr:'כרמל אליאס 18',     note:'בית כנסת בית חב"ד' },
  { num:'28', addr:'רזיאל 8',           note:'מחסה' },
  { num:'29', addr:'רזיאל 28',          note:'מחסה' },
  { num:'30', addr:'רמב"ם 40',          note:'' },
  { num:'31', addr:'רמב"ם 15',          note:'מועדונית רמב"ם' },
  { num:'32', addr:'הח"ם 22',           note:'בית כנסת חלב חיטים' },
  { num:'33', addr:'שי עגנון 12',       note:'מועדונית מורשה' },
  { num:'34', addr:'ששת הימים 56',      note:'מקווה גברים' },
];

function inBounds(lat, lon) { return lat >= 32.75 && lat <= 32.78 && lon >= 34.96 && lon <= 35.00; }
function geocode(address) {
  const query = `${address}, טירת כרמל, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in טירת כרמל...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`טירת-כרמל-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'טירת כרמל',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  const p=path.join(__dirname,'..','data','tirat-carmel-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${oob.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
  if(oob.length)oob.forEach(o=>console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
