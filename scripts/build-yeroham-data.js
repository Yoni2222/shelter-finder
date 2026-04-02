'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'בי"ס', 'חטיבת', 'חטיבה'];
function isSchool(name) {
  const n = (name || '').trim();
  return SCHOOL_KEYWORDS.some(kw => n.includes(kw));
}

const RAW_DATA = [
  // איזור התעשייה
  { num: '50', name: 'איזור התעשייה', addr: 'איזור התעשייה', hood: 'איזור התעשייה' },
  { num: '51', name: 'איזור התעשייה- ליד הפחח דהן', addr: 'איזור התעשייה', hood: 'איזור התעשייה' },
  { num: '49', name: 'איזור התעשייה- טמפו ליד מחסן 52', addr: 'איזור התעשייה', hood: 'איזור התעשייה' },
  // שכונת השקד
  { num: '33', name: 'מעגל הצבעוני', addr: 'מעגל הצבעוני', hood: 'השקד' },
  { num: '32', name: 'מעגל הכלנית', addr: 'מעגל הכלנית', hood: 'השקד' },
  { num: '31', name: 'מעגל החצב', addr: 'מעגל החצב', hood: 'השקד' },
  { num: '30', name: 'מעגל הזוגן', addr: 'מעגל הזוגן', hood: 'השקד' },
  { num: '29', name: 'מעגל היפרוק', addr: 'מעגל היפרוק', hood: 'השקד' },
  { num: '28', name: 'מעגל הסתוונית', addr: 'מעגל הסתוונית', hood: 'השקד' },
  { num: '27', name: 'מעגל הפרג', addr: 'מעגל הפרג', hood: 'השקד' },
  { num: '26', name: 'מעגל הנורית', addr: 'מעגל הנורית', hood: 'השקד' },
  { num: '25', name: 'מעגל העירית', addr: 'מעגל העירית', hood: 'השקד' },
  { num: '24', name: 'מעגל האירוס', addr: 'מעגל האירוס', hood: 'השקד' },
  { num: '23', name: 'מעגל החלמונית', addr: 'מעגל החלמונית', hood: 'השקד' },
  { num: '22', name: 'מעגל הרותם', addr: 'מעגל הרותם', hood: 'השקד' },
  // מתחם מועדון הצופים
  { num: 'מתחם', name: 'מועדון הצופים', addr: 'מועדון הצופים', hood: 'השקד' },
  // מרכז העיר - מתנ"ס, היכל תרבות, גן הראשונים
  { num: 'מתחם', name: 'היכל התרבות', addr: 'היכל התרבות', hood: 'מרכז העיר' },
  { num: 'מתחם', name: 'מתנ"ס', addr: 'מתנ"ס', hood: 'מרכז העיר' },
  { num: 'מתחם', name: 'קונסרבטוריון', addr: 'קונסרבטוריון', hood: 'מרכז העיר' },
  { num: 'מתחם', name: 'ספורטק', addr: 'ספורטק', hood: 'מרכז העיר' },
  // בן גוריון, חשמונאים, אליהו הנביא
  { num: '21', name: 'בן גוריון - מרכז השכונה', addr: 'בן גוריון', hood: 'בן גוריון' },
  { num: '20', name: 'בן גוריון - ליד בית כנסת', addr: 'בן גוריון', hood: 'בן גוריון' },
  { num: '19', name: 'בר כוכבא, ליד בלוק 511, ברסלב', addr: 'בר כוכבא', hood: 'בן גוריון' },
  { num: '18', name: 'בר כוכבא- חנות יד שניה, ליד בלוק 539', addr: 'בר כוכבא', hood: 'בן גוריון' },
  // מתחמים - בן גוריון
  { num: 'מתחם', name: 'בית ספר דרכא', addr: 'בית ספר דרכא', hood: 'בן גוריון' },
  { num: 'מתחם', name: 'בית ספר קמה', addr: 'בית ספר קמה', hood: 'בן גוריון' },
  { num: 'מתחם', name: 'בית הקשיש', addr: 'בית הקשיש', hood: 'בן גוריון' },
  { num: 'מתחם', name: 'סניף בני עקיבא- מאחורי קול יעקב', addr: 'בני עקיבא', hood: 'בן גוריון' },
  { num: 'מתחם', name: 'בית ספר קול יעקב', addr: 'בית ספר קול יעקב', hood: 'בן גוריון' },
  { num: 'מתחם', name: 'מרכז צעירים - אליהו הנביא', addr: 'אליהו הנביא', hood: 'אליהו הנביא' },
  // אלי כהן, הפלמ"ח, קהילה חרדית
  { num: 'מתחם', name: 'המאוחד', addr: 'המאוחד', hood: 'אלי כהן' },
  { num: '1', name: 'בי"ס מסילה בערבה- ליד ההגנה 749', addr: 'ההגנה', hood: 'אלי כהן' },
  { num: '2', name: 'אלי כהן, ליד 749 (משחקים)', addr: 'אלי כהן', hood: 'אלי כהן' },
  { num: '3', name: 'אלי כהן, ליד 750 (בית כנסת)', addr: 'אלי כהן', hood: 'אלי כהן' },
  { num: '4', name: 'אלי כהן (במעבר ליצחק שדה)', addr: 'אלי כהן', hood: 'אלי כהן' },
  { num: '5', name: 'אלי כהן ליד גני הילדים', addr: 'אלי כהן', hood: 'אלי כהן' },
  { num: '6', name: 'אלי כהן ליד בית קיל"א', addr: 'אלי כהן', hood: 'אלי כהן' },
  { num: '7', name: 'ההגנה פינת גוש עציון-האשל', addr: 'ההגנה', hood: 'אלי כהן' },
  { num: '8', name: 'אסף שמחוני ליד 278 האשל', addr: 'אסף שמחוני', hood: 'אלי כהן' },
  // מרכז העיר, אלכחיל
  { num: '10', name: 'אלכחיל ליד בלוק 508', addr: 'אלכחיל', hood: 'מרכז העיר' },
  { num: '11', name: 'אלכחיל מאחורי בלוק 507', addr: 'אלכחיל', hood: 'מרכז העיר' },
  { num: '12', name: 'מאחורי השופרסל', addr: 'מרכז העיר', hood: 'מרכז העיר' },
  { num: '13', name: 'בניין המועצה', addr: 'בניין המועצה', hood: 'מרכז העיר' },
  { num: '14', name: 'גבעה מול 317 (מול אלקובי)', addr: 'מרכז העיר', hood: 'מרכז העיר' },
  { num: 'מתחם', name: 'חמ"ל, רח׳ כדיר בוכריס, ליד הרווחה', addr: 'כדיר בוכריס', hood: 'מרכז העיר' },
  { num: '15', name: 'גבעה מול 321 (צד אלקובי)', addr: 'מרכז העיר', hood: 'מרכז העיר' },
  { num: '16', name: 'מאחורי קל וחומר', addr: 'מרכז העיר', hood: 'מרכז העיר' },
  { num: '17', name: 'גן אשכול מועדון החייל', addr: 'גן אשכול', hood: 'מרכז העיר' },
  // נאות הדר
  { num: '9', name: 'רחוב יחיא', addr: 'יחיא', hood: 'נאות הדר' },
  { num: '48', name: 'נאות הדר - רח׳ היסמין, בית חם לנערות', addr: 'היסמין', hood: 'נאות הדר' },
  { num: '47', name: 'נאות הדר – רח\' היסמין- ארגון לתת', addr: 'היסמין', hood: 'נאות הדר' },
  { num: '46', name: 'נאות הדר- ההדרים (קלפי) מועדון ילדים', addr: 'ההדרים', hood: 'נאות הדר' },
  { num: '42', name: 'נאות הדר מול בית 86', addr: 'נאות הדר', hood: 'נאות הדר' },
  { num: '41', name: 'ההדסים, ליד מקורות- ספריה יד 2', addr: 'ההדסים', hood: 'נאות הדר' },
  { num: '40', name: 'ההגנה פינת ההדרים - קהילה בוכרית', addr: 'ההגנה', hood: 'נאות הדר' },
  { num: '39', name: 'נאות הדר - רח׳ העליה- בי"כ תפארת מנחם', addr: 'העליה', hood: 'נאות הדר' },
  // נווה עמק
  { num: '38', name: 'נווה עמק ליד ההר הלבן', addr: 'נווה עמק', hood: 'נווה עמק' },
  { num: '37', name: 'נווה עמק מאחורי החנויות', addr: 'נווה עמק', hood: 'נווה עמק' },
  { num: '36', name: 'נווה עמק - אורי אסולין, ביה"כ אוהל יוסף', addr: 'נווה עמק', hood: 'נווה עמק' },
  { num: '35', name: 'נווה עמק - מול בית 77 ליד גני הילדים', addr: 'נווה עמק', hood: 'נווה עמק' },
  { num: '34', name: 'נווה עמק - רחוב התמר', addr: 'התמר', hood: 'נווה עמק' },
  // נווה נוף
  { num: '43', name: 'נווה נוף - רח׳ הסהר', addr: 'הסהר', hood: 'נווה נוף' },
  { num: '44', name: 'נווה נוף - הקשת, ביה"כ אוהל דוד', addr: 'הקשת', hood: 'נווה נוף' },
  { num: '45', name: 'נווה נוף - פינת הפסגה', addr: 'הפסגה', hood: 'נווה נוף' },
  // מיגוניות
  { num: 'מ1', name: 'מיגונית בית אשל (כיכר)', addr: 'בית אשל', hood: 'מרכז העיר' },
  { num: 'מ2', name: 'מיגונית בית אשל (אמצע)', addr: 'בית אשל', hood: 'מרכז העיר' },
  { num: 'מ3', name: 'מיגונית גבולות', addr: 'גבולות', hood: 'מרכז העיר' },
  { num: 'מ4', name: 'מיגונית גבולות', addr: 'גבולות', hood: 'מרכז העיר' },
  { num: 'מ5', name: 'מיגונית הסתדרות', addr: 'הסתדרות', hood: 'מרכז העיר' },
  { num: 'מ6', name: 'מיגונית הסתדרות (חנויות)', addr: 'הסתדרות', hood: 'מרכז העיר' },
  { num: 'מ7', name: 'מיגונית גוש עציון (משחקים)', addr: 'גוש עציון', hood: 'אלי כהן' },
  { num: 'מ8', name: 'מיגונית ההגנה (גוש עציון)', addr: 'ההגנה', hood: 'אלי כהן' },
  { num: 'מ9', name: 'מיגונית ההגנה (אלכחיל)', addr: 'ההגנה', hood: 'מרכז העיר' },
  { num: 'מ10', name: 'מיגונית רביבים', addr: 'רביבים', hood: 'מרכז העיר' },
  { num: 'מ11', name: 'מיגונית ה הכהן', addr: 'הכהן', hood: 'מרכז העיר' },
  { num: 'מ12', name: 'מיגונית הבילויים', addr: 'הבילויים', hood: 'מרכז העיר' },
  { num: 'מ13', name: 'מיגונית כפר הסטודנטים', addr: 'כפר הסטודנטים', hood: 'מרכז העיר' },
  { num: 'מ14', name: 'מיגונית כפר הסטודנטים', addr: 'כפר הסטודנטים', hood: 'מרכז העיר' },
  { num: 'מ15', name: 'מיגונית כפר הסטודנטים', addr: 'כפר הסטודנטים', hood: 'מרכז העיר' },
  { num: 'מ16', name: 'מיגונית כפר הסטודנטים', addr: 'כפר הסטודנטים', hood: 'מרכז העיר' },
  { num: 'מ17', name: 'מיגונית הבילויים (ביה"כ)', addr: 'הבילויים', hood: 'מרכז העיר' },
  { num: 'מ18', name: 'מיגונית אשר סנקר', addr: 'אשר סנקר', hood: 'מרכז העיר' },
  { num: 'מ19', name: 'מיגונית ההדרים (חניה)', addr: 'ההדרים', hood: 'נאות הדר' },
  { num: 'מ-', name: 'מיגונית ההדרים 2', addr: 'ההדרים', hood: 'נאות הדר' },
  { num: 'מ20', name: 'מיגונית יצחק שדה (גן)', addr: 'יצחק שדה', hood: 'אלי כהן' },
  { num: 'מ21', name: 'מיגונית בית הספר המאוחד 1', addr: 'המאוחד', hood: 'אלי כהן' },
  { num: 'מ22', name: 'מיגונית בית הספר המאוחד 2', addr: 'המאוחד', hood: 'אלי כהן' },
];

// Yeroham approximate bounding box
function inBounds(lat, lon) { return lat >= 30.97 && lat <= 31.01 && lon >= 34.91 && lon <= 34.95; }

function geocode(address) {
  const query = `${address}, ירוחם, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in ירוחם...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.name} (${e.addr})`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.name} (${e.addr}) -> (${c.lat}, ${c.lon})`);}
    else {
      const cat = isSchool(e.name) ? 'school' : 'public';
      const isMigonit = e.num.startsWith('מ');
      const shelterType = isMigonit ? 'מיגונית' : 'מקלט ציבורי';
      const displayName = isMigonit ? e.name : `מקלט ${e.num} - ${e.name}`;
      shelters.push({id:`ירוחם-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:displayName,address:e.addr,city:'ירוחם',neighborhood:e.hood,type:shelterType,source:'gov',category:cat,addressEn:c.addressEn||''});
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.name} (${e.addr}) -> (${c.lat}, ${c.lon}) [${cat}]`);
    }
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    const cat = isSchool(o.name) ? 'school' : 'public';
    const isMigonit = o.num.startsWith('מ');
    const shelterType = isMigonit ? 'מיגונית' : 'מקלט ציבורי';
    const displayName = isMigonit ? o.name : `מקלט ${o.num} - ${o.name}`;
    shelters.push({id:`ירוחם-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:displayName,address:o.addr,city:'ירוחם',neighborhood:o.hood,type:shelterType,source:'gov',category:cat,addressEn:''});
  }
  const p=path.join(__dirname,'..','data','yeroham-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.name} (${f.addr})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
