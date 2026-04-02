'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// Data from https://www.ganyavne.muni.il/Departments/Emergency/Pages/Shelters.aspx
// מקלטים (shelters) + מיגוניות (protected spaces)
const RAW_DATA = [
  // ===== מקלטים =====
  { name: 'מקלט 1 - בן גוריון',            addr: 'בן גוריון',           category: 'public' },
  { name: 'מקלט 3 - אחוזה',                addr: 'אחוזה',               category: 'public' },
  { name: 'מקלט 4 - יפתח',                 addr: 'יפתח',                category: 'public' },
  { name: 'מקלט 5 - הרצל (גן העיר)',       addr: 'הרצל',                category: 'public' },
  { name: 'מקלט 6 - אביר יעקב גן מישלי',   addr: 'אביר יעקב',           category: 'public' },
  { name: 'מקלט 7 - בר יוחאי (בית כנסת)',   addr: 'בר יוחאי',            category: 'public' },
  { name: 'מקלט 8 - שלמה המלך',            addr: 'שלמה המלך',           category: 'public' },
  { name: 'מקלט 13 - ניצחון',              addr: 'ניצחון',              category: 'public' },
  { name: 'מקלט 14 - עפרוני',              addr: 'עפרוני',              category: 'public' },
  { name: 'מקלט 17 - השומר',               addr: 'השומר',               category: 'public' },
  { name: 'מקלט 19 - הנשיא (מועדון נוער)',  addr: 'הנשיא',               category: 'public' },
  { name: 'מקלט 23 - תבור (בית כנסת)',      addr: 'תבור',                category: 'public' },
  { name: 'מקלט 24 - שמואל אוחיון (מועדון נוער)', addr: 'שמואל אוחיון',  category: 'public' },
  // ===== מיגוניות =====
  { name: 'מיגונית 1 - אלי כהן',           addr: 'אלי כהן',            category: 'public' },
  { name: 'מיגונית 2 - הרצל 2',            addr: 'הרצל 2',             category: 'public' },
  { name: 'מיגונית 3 - הרצל 8',            addr: 'הרצל 8',             category: 'public' },
  { name: 'מיגונית 4 - הרצל 39',           addr: 'הרצל 39',            category: 'public' },
  { name: 'מיגונית 5 - אביר יעקב',         addr: 'אביר יעקב',          category: 'public' },
  { name: 'מיגונית 6 - תבור',              addr: 'תבור',               category: 'public' },
  { name: 'מיגונית 7 - שמואל אוחיון',      addr: 'שמואל אוחיון',       category: 'public' },
  { name: 'מיגונית 8 - דרך קנדה',          addr: 'דרך קנדה',           category: 'public' },
  { name: 'מיגונית 9 - אחד העם',           addr: 'אחד העם',            category: 'public' },
  { name: 'מיגונית 10 - גלבוע (קן הצופים)', addr: 'גלבוע',              category: 'public' },
  { name: 'מיגונית 11 - הרצל (גן העיר)',    addr: 'הרצל',               category: 'public' },
  { name: 'מיגונית 12 - אנפה/שלדג',        addr: 'אנפה',               category: 'public' },
  { name: 'מיגונית 13 - כיכר זמיר',        addr: 'זמיר',               category: 'public' },
  { name: 'מיגונית 14 - תורה ועבודה 21',    addr: 'תורה ועבודה 21',     category: 'public' },
  { name: 'מיגונית 15 - רחל המשוררת 2',     addr: 'רחל המשוררת 2',      category: 'public' },
  { name: 'מיגונית 16 - צומת גן יבנה/שתולים', addr: 'צומת גן יבנה',     category: 'public' },
  { name: 'מיגונית 17 - אהוד בן גרא/הנביאים', addr: 'אהוד בן גרא',     category: 'public' },
  { name: 'מיגונית 18 - הדרים 4',           addr: 'הדרים 4',            category: 'public' },
];

// School/kindergarten keywords for category detection
const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'בי"ס', 'חטיבת', 'חטיבה', 'תיכון', 'ת"ת'];
// גן as kindergarten - but NOT when it's part of the city name גן יבנה or גן העיר (park) or גן שעשועים (playground) or גן מישלי or גן פיטו
const GAN_EXCEPTIONS = ['גן יבנה', 'גן העיר', 'גן שעשועים', 'גן מישלי', 'גן פיטו'];

function isSchool(name, addr) {
  const n = (name || '') + ' ' + (addr || '');
  if (SCHOOL_KEYWORDS.some(kw => n.includes(kw))) return true;
  // Check for גן as kindergarten, excluding exceptions
  if (n.includes('גן') && !GAN_EXCEPTIONS.some(ex => n.includes(ex))) {
    // Only if "גן" appears as a kindergarten context (e.g. "גן ילדים", "גן חובה")
    if (/גן\s*(ילדים|חובה|טרום)/.test(n)) return true;
  }
  return false;
}

// Bounding box for Gan Yavne (approx)
function inBounds(lat, lon) { return lat >= 31.76 && lat <= 31.80 && lon >= 34.68 && lon <= 34.73; }

function geocode(address) {
  const query = `${address}, גן יבנה, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in גן יבנה...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    const cat = e.category === 'school' || isSchool(e.name, e.addr) ? 'school' : 'public';
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.name} (${e.addr})`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,lat:c.lat,lon:c.lon,addressEn:c.addressEn});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.name} (${e.addr}) -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`גן יבנה-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:e.name,address:e.addr,city:'גן יבנה',type:'מקלט ציבורי',source:'gov',category:cat,addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.name} (${e.addr}) -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    const cat = o.category === 'school' || isSchool(o.name, o.addr) ? 'school' : 'public';
    shelters.push({id:`גן יבנה-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:o.name,address:o.addr,city:'גן יבנה',type:'מקלט ציבורי',source:'gov',category:cat,addressEn:o.addressEn||''});
  }
  const p=path.join(__dirname,'..','data','gan-yavne-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.name} (${f.addr})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
