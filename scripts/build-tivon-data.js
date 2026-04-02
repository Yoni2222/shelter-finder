'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'בי"ס', 'חטיבת', 'חטיבה', 'תיכון'];
function isSchool(name) {
  const lower = name;
  return SCHOOL_KEYWORDS.some(kw => lower.includes(kw));
}

const RAW_DATA = [
  { num:'1',  name:'ורדים',                addr:'הגפן 15ג',                     desc:'על הגבעה מאחורי הוורדים 8' },
  { num:'2',  name:'ורדים',                addr:'שכונת ורדים',                   desc:'צמוד לגן יבנה' },
  { num:'3',  name:'החבצלת',              addr:'משעול הלוטם',                   desc:'ליד המיני פיצ\'' },
  { num:'4',  name:'מרגניות',              addr:'מרגניות פינת הגפן 1',          desc:'פינת הגפן 1' },
  { num:'5',  name:'הברושים',              addr:'הברושים 85',                    desc:'ליד בית מספר 85, על יד המקווה' },
  { num:'6',  name:'הברושים',              addr:'הברושים 89',                    desc:'ליד בית מספר 89, על יד בית הכנסת' },
  { num:'7',  name:'התאנה',                addr:'התאנה 12',                      desc:'מתחת גן הילדים' },
  { num:'8',  name:'בית ספר נרקיסים',     addr:'בית ספר נרקיסים',               desc:'חצר בית הספר' },
  { num:'10', name:'ציפורנים',             addr:'ציפורנים 13',                   desc:'על הגבעה, על יד גן הילדים' },
  { num:'11', name:'החורש',                addr:'החורש 64',                      desc:'ליד בית 64' },
  { num:'12', name:'סמטת האלה',           addr:'סמטת האלה 2',                   desc:'ליד בית 2' },
  { num:'13', name:'האלה',                 addr:'האלה 2 פינת השיטים',            desc:'פינת השיטים' },
  { num:'14', name:'אמנון ותמר',           addr:'אמנון ותמר 15',                 desc:'על הגבעה מול בית מספר 15' },
  { num:'15', name:'רקפות',                addr:'רקפות 4 פינת אמנון ותמר',       desc:'במגרש החניה' },
  { num:'16', name:'מועדון נרקיס',         addr:'רחוב מרגניות',                  desc:'מועדון נרקיס' },
  { num:'17', name:'דגניות',               addr:'דגניות 13',                     desc:'מול המתנ"ס' },
  { num:'18', name:'דגניות',               addr:'דגניות 12',                     desc:'חצר המתנ"ס' },
  { num:'19', name:'רמז',                  addr:'רמז 67',                        desc:'פינת אלונים' },
  { num:'20', name:'רמז',                  addr:'רמז 22',                        desc:'' },
  { num:'21', name:'רמז',                  addr:'רמז 1',                         desc:'פינת בורוכוב – הנשיא' },
  { num:'22', name:'יד שרה',               addr:'אורנים 27',                     desc:'רחוב אורנים 27' },
  { num:'24', name:'בי"ס רימונים',         addr:'סמטת חרוב',                     desc:'על יד אולם הספורט' },
  { num:'25', name:'יהודה הנשיא',          addr:'יהודה הנשיא 21',                desc:'מאחורי גן שקד' },
  { num:'26', name:'חנה סנש',              addr:'חנה סנש 1',                     desc:'פינת יזרעאל' },
  { num:'27', name:'יזרעאל',               addr:'יזרעאל 49',                     desc:'על יד בית מספר 49' },
  { num:'28', name:'הבונים',               addr:'הבונים 33',                     desc:'על יד גן הילדים' },
  { num:'29', name:'בית ספר קרית עמל',    addr:'קק"ל 19',                       desc:'בתוך בית הספר' },
  { num:'30', name:'בית ספר קרית עמל',    addr:'מייסדים',                       desc:'רחוב מייסדים' },
  { num:'31', name:'העמק',                 addr:'העמק 1',                        desc:'בית כנסת חסדי אבות' },
  { num:'32', name:'כצנלסון',              addr:'כצנלסון 9',                     desc:'פינת אלכסנדר זייד' },
  { num:'33', name:'כצנלסון',              addr:'כצנלסון 11',                    desc:'' },
  { num:'37', name:'בית הספר התיכון',      addr:'כצנלסון 35',                    desc:'מבנה מרכזי, בית הספר התיכון' },
  { num:'38', name:'בית הספר התיכון',      addr:'כצנלסון 35',                    desc:'על יד המזנון, בית הספר התיכון' },
  { num:'40', name:'סמטת פיש',            addr:'סמטת פיש',                      desc:'כניסה לסמטת פיש, מועדון הקשישים' },
  { num:'41', name:'מועדון נוער פיש',      addr:'סמטת פיש 35',                   desc:'' },
  { num:'42', name:'אלרואי',               addr:'התשבי 2',                       desc:'על יד בית הכנסת אליהו הנביא' },
  { num:'43', name:'אלרואי',               addr:'התשבי 23',                      desc:'מול רחוב התשבי 23 על יד מגרש הכדורגל' },
  { num:'44', name:'קרית חרושת',           addr:'הרצל פינת הרותם',               desc:'על יד תיבות הדואר' },
  { num:'45', name:'קרית חרושת',           addr:'הנרייטה סולד 10',               desc:'גן צבעוני' },
  { num:'50', name:'גני ילדים צל אורנים',  addr:'מנחם בגין 1',                   desc:'' },
];

// Bounding box for Kiryat Tivon
// Expanded bounding box to include northern neighborhoods (Vradim, Habroshim) and southern Kiryat Haroshet
function inBounds(lat, lon) { return lat >= 32.685 && lat <= 32.73 && lon >= 35.095 && lon <= 35.15; }

function geocode(address) {
  const query = `${address}, קריית טבעון, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in קריית טבעון...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else {
      const category = isSchool(e.name) || isSchool(e.desc) ? 'school' : 'public';
      const displayName = `מקלט ${e.num} - ${e.name}`;
      const fullAddr = e.desc ? `${e.addr} (${e.desc})` : e.addr;
      shelters.push({id:`קריית טבעון-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:displayName,address:fullAddr,city:'קריית טבעון',type:'מקלט ציבורי',source:'gov',category,addressEn:c.addressEn||''});
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon}) [${category}]`);
    }
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    const category = isSchool(o.name) || isSchool(o.desc) ? 'school' : 'public';
    const displayName = `מקלט ${o.num} - ${o.name}`;
    const fullAddr = o.desc ? `${o.addr} (${o.desc})` : o.addr;
    shelters.push({id:`קריית טבעון-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:displayName,address:fullAddr,city:'קריית טבעון',type:'מקלט ציבורי',source:'gov',category,addressEn:''});
  }
  const p=path.join(__dirname,'..','data','tivon-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1)});
