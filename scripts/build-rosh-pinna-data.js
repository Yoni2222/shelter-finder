'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const RAW_DATA = [
  // ציבורי (public shelters)
  { num: '1',  addr: 'רח\' העליון החלוצים 19',        note: 'ליד האכסנייא' },
  { num: '2',  addr: 'דרך בן אריה',                   note: 'מאחורי סיבוב זרחיה' },
  { num: '3',  addr: 'רחוב החלוצים 3',                 note: 'ליד מרכזיית בזק מול סופר ספיר' },
  { num: '8',  addr: 'מעלה גיא אוני 6',               note: 'ליד קופת חולים' },
  { num: '9',  addr: 'מעלה גיא אוני 8',               note: 'ליד בלוק 226' },
  { num: '24', addr: 'גיא אוני',                      note: 'מעל למתחם החאן' },
  { num: '23', addr: 'שביל הברושים 6',                 note: 'ליד בית כנסת אלי כהן' },
  { num: '25', addr: 'רח\' פטר פביאן 17',             note: 'ליד מרייקה' },
  { num: '26', addr: 'רחוב השלום 2',                   note: 'ליד בית רובינשטיין' },
  { num: '27', addr: 'משעול הזיתים 18',                note: 'שכונת הזיתים' },
  { num: '28', addr: 'הרדוף 5',                        note: 'הרחבה א' },
  { num: '29', addr: 'השיטה 19',                       note: 'הרחבה א ליד השער הצפוני' },
  { num: '30', addr: 'השזיף 17',                       note: 'הרחבה ב' },
  { num: '31', addr: 'האפרסק 24',                     note: 'הרחבה ב מערבי' },
  { num: '32', addr: 'האפרסק 1',                      note: 'הרחבה ב מזרחי' },
  { num: '33', addr: 'דוד שו"ב 2',                    note: 'מתחת לפעמוני ירושלים' },
  { num: '42', addr: 'התורמוס 18',                     note: 'הרחבה ג' },
  { num: '41', addr: 'התורמוס 30',                     note: 'הרחבה ג' },
  { num: '43', addr: 'התורמוס 9',                      note: 'הרחבה ג אמצע' },
  { num: '44', addr: 'התורמוס 2',                      note: 'הרחבה ג תחתון' },
  { num: '40', addr: 'התורמוס 31',                     note: 'הרחבה ג חלק עליון ליד גן המשחקים' },
  { num: '45', addr: 'הנורית 9',                       note: 'פני גולן' },
  { num: '34', addr: 'דרך הבוסתנים 2',                note: '' },
  { num: '35', addr: 'הבוסתנים 25',                   note: 'פני גולן סוף הבוסתנים' },
  { num: '36', addr: 'האירוס 13',                      note: 'פני גולן' },
  { num: '37', addr: 'הרקפת 10',                       note: 'פני גולן אמצע' },
  { num: '38', addr: 'הרקפת 30',                       note: 'פני גולן פניה לכלנית' },
  { num: '39', addr: 'כלנית 19',                       note: 'פני גולן אמצע' },
  // מיגוניות (mobile shelters)
  { num: '201', addr: 'כיכר דוד שוב',                  note: 'מיגונית', type: 'מיגונית' },
  { num: '202', addr: 'רחוב עמיקם שמאי',              note: 'מיגונית', type: 'מיגונית' },
  { num: '203', addr: 'דרך היקב',                      note: 'מיגונית', type: 'מיגונית' },
  { num: '204', addr: 'דרך הטחנה',                     note: 'מיגונית כניסה לחרוב ליד גן המשחקים', type: 'מיגונית' },
  { num: '205', addr: 'דרך הגליל',                     note: 'מיגונית מתחם מסחרי אשכנזי', type: 'מיגונית' },
  { num: '206', addr: 'דרך הגליל פינת רחוב התפוח',    note: 'מיגונית ליד בית קפה רנה', type: 'מיגונית' },
  { num: '207', addr: 'דרך הגליל',                     note: 'מיגונית מתחם מסחרי אשכנזי', type: 'מיגונית' },
  // מחסה (refuge shelters)
  { num: '101', addr: 'הרימונים',                      note: 'מחסה בקצה הדרומי', type: 'מחסה' },
  { num: '102', addr: 'הרימונים',                      note: 'מחסה אמצע מצד ימין', type: 'מחסה' },
  { num: '103', addr: 'הרימונים',                      note: 'מחסה אמצע מצד שמאל', type: 'מחסה' },
  { num: '104', addr: 'הרימונים',                      note: 'מחסה ליד בית הכנסת הרומני', type: 'מחסה' },
  { num: '105', addr: 'התמרים',                        note: 'מחסה', type: 'מחסה' },
  { num: '106', addr: 'כיכר דוד שוב',                  note: 'מחסה', type: 'מחסה' },
  { num: '107', addr: 'השיטה',                         note: 'מחסה הרחבה א', type: 'מחסה' },
  { num: '109', addr: 'דרך החלמונית',                  note: 'מחסה גינה קהילתית', type: 'מחסה' },
];

// School/kindergarten keywords for category detection
const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'חטיבת', 'גן ', 'גן ילדים', 'תיכון', 'אולפנה', 'ישיבה', 'מעון'];

function isSchool(name, addr) {
  const combined = (name + ' ' + addr).toLowerCase();
  return SCHOOL_KEYWORDS.some(kw => combined.includes(kw));
}

// Rosh Pinna bounding box (approx)
function inBounds(lat, lon) { return lat >= 32.94 && lat <= 32.98 && lon >= 35.52 && lon <= 35.56; }

function geocode(address) {
  const query = `${address}, ראש פינה, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in ראש פינה...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    const shelterType = e.type === 'מיגונית' ? 'מיגונית' : e.type === 'מחסה' ? 'מחסה' : 'מקלט ציבורי';
    const namePrefix = e.type === 'מיגונית' ? 'מיגונית' : e.type === 'מחסה' ? 'מחסה' : 'מקלט';
    const name = `${namePrefix} ${e.num}`;
    const category = isSchool(name, e.addr) ? 'school' : 'public';
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,lat:c.lat,lon:c.lon,addressEn:c.addressEn,shelterType,name,category});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`ראש פינה-${shelters.length+1}`,lat:c.lat,lon:c.lon,name,address:e.addr,city:'ראש פינה',type:shelterType,source:'gov',category,addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    shelters.push({id:`ראש פינה-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:o.name,address:o.addr,city:'ראש פינה',type:o.shelterType,source:'gov',category:o.category,addressEn:o.addressEn||''});
  }
  const p=path.join(__dirname,'..','data','rosh-pinna-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
