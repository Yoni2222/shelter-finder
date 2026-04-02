'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// Decoded from reversed-Hebrew PDF (5 pages)
// Only including operational shelters (מוסב = כן)
const RAW_DATA = [
  // Page 1
  { num:'1',   addr: 'בן גוריון',          geocodeAddr: 'בן גוריון' },
  { num:'2',   addr: 'פקיעין 6',            geocodeAddr: 'פקיעין 6' },
  { num:'3',   addr: 'תבור 3',              geocodeAddr: 'תבור 3' },
  { num:'4',   addr: 'תבור 4',              geocodeAddr: 'תבור 4' },
  { num:'5',   addr: 'בן גוריון 15',        geocodeAddr: 'בן גוריון 15' },
  { num:'6',   addr: 'התאנה 38',             geocodeAddr: 'התאנה 38' },
  { num:'7',   addr: 'הרב משאש 8',           geocodeAddr: 'הרב משאש 8' },
  { num:'8',   addr: 'הרב משאש 14',          geocodeAddr: 'הרב משאש 14' },
  { num:'9',   addr: 'מעלה חסון 146',        geocodeAddr: 'מעלה חסון 146' },
  { num:'10',  addr: 'מעלה חסון 148',        geocodeAddr: 'מעלה חסון 148' },
  { num:'11',  addr: 'מעלה חסון 143',        geocodeAddr: 'מעלה חסון 143' },
  { num:'12',  addr: 'מעלה חסון 140',        geocodeAddr: 'מעלה חסון 140' },
  { num:'13',  addr: 'קרן היסוד 34',         geocodeAddr: 'קרן היסוד 34' },
  { num:'14',  addr: 'הגליל 13',             geocodeAddr: 'הגליל 13' },
  { num:'15',  addr: 'כליל החורש 5',         geocodeAddr: 'כליל החורש 5' },
  { num:'16',  addr: 'מרכז מסחרי',           geocodeAddr: 'מרכז מסחרי' },
  // Page 2
  { num:'18',  addr: 'בן גוריון 1',          geocodeAddr: 'בן גוריון 1' },
  { num:'21',  addr: 'הרב קוק 25',           geocodeAddr: 'הרב קוק 25' },
  { num:'25',  addr: 'ירושלים 20',            geocodeAddr: 'ירושלים 20' },
  { num:'26',  addr: 'ירושלים 17',            geocodeAddr: 'ירושלים 17' },
  { num:'27',  addr: 'תדהר 2',               geocodeAddr: 'תדהר 2' },
  { num:'28',  addr: 'ירושלים 13',            geocodeAddr: 'ירושלים 13' },
  { num:'30',  addr: 'מעלה הבנים 33',         geocodeAddr: 'מעלה הבנים 33' },
  { num:'44',  addr: 'תרשיחא',               geocodeAddr: 'תרשיחא' },
  // Page 3
  { num:'49',  addr: 'שכונה דרומית',          geocodeAddr: 'שכונה דרומית' },
  { num:'50',  addr: 'תרשיחא',               geocodeAddr: 'תרשיחא' },
  { num:'51',  addr: 'אלעלא 9',              geocodeAddr: 'אלעלא 9' },
  { num:'52',  addr: 'אזור תעשייה',           geocodeAddr: 'אזור תעשייה' },
  { num:'53',  addr: 'אזור תעשייה',           geocodeAddr: 'אזור תעשייה' },
  { num:'54',  addr: 'אזור תעשייה',           geocodeAddr: 'אזור תעשייה' },
  { num:'55',  addr: 'אזור תעשייה',           geocodeAddr: 'אזור תעשייה' },
  { num:'56',  addr: 'שכונת הנרקיסים',        geocodeAddr: 'הנרקיסים' },
  { num:'64',  addr: 'סיגליות 28',            geocodeAddr: 'סיגליות 28' },
  { num:'65',  addr: 'סיגליות 36',            geocodeAddr: 'סיגליות 36' },
  { num:'68',  addr: 'סיגליות 53',            geocodeAddr: 'סיגליות 53' },
  { num:'71',  addr: 'סיגליות 61',            geocodeAddr: 'סיגליות 61' },
  // Page 4 - שכונת המלכים
  { num:'929', addr: 'דוד המלך 7',            geocodeAddr: 'דוד המלך 7' },
  { num:'930', addr: 'שיבת ציון 6',           geocodeAddr: 'שיבת ציון 6' },
  { num:'931', addr: 'שאול המלך 5',           geocodeAddr: 'שאול המלך 5' },
  { num:'932', addr: 'שלמה המלך 3',           geocodeAddr: 'שלמה המלך 3' },
  { num:'933', addr: 'שאול המלך 10',          geocodeAddr: 'שאול המלך 10' },
  { num:'934', addr: 'שלמה המלך 21',          geocodeAddr: 'שלמה המלך 21' },
  { num:'935', addr: 'דוד המלך 16',           geocodeAddr: 'דוד המלך 16' },
  { num:'936', addr: 'דוד המלך 22',           geocodeAddr: 'דוד המלך 22' },
  { num:'937', addr: 'דוד המלך 26',           geocodeAddr: 'דוד המלך 26' },
  { num:'939', addr: 'דוד המלך 44',           geocodeAddr: 'דוד המלך 44' },
  { num:'940', addr: 'דוד המלך 56',           geocodeAddr: 'דוד המלך 56' },
];

function inBounds(lat, lon) { return lat >= 33.00 && lat <= 33.04 && lon >= 35.25 && lon <= 35.30; }
function geocode(address) {
  const query = `${address}, מעלות-תרשיחא, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in מעלות-תרשיחא...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.geocodeAddr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`מעלות-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:`מקלט ${e.num}`,address:e.addr,city:'מעלות-תרשיחא',type:'מקלט ציבורי',source:'gov',category:'public',addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  const p=path.join(__dirname,'..','data','maalot-tarshiha-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${oob.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
  if(oob.length)oob.forEach(o=>console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
