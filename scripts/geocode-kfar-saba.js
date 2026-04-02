"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const GOOGLE_API_KEY = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/GOOGLE_MAPS_API_KEY=(.*)/)[1].trim();
const BOUNDS = { latMin: 32.15, latMax: 32.22, lonMin: 34.87, lonMax: 34.95 };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function googleGeocode(address, language) {
  return new Promise((resolve, reject) => {
    const url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(address) + "&key=" + GOOGLE_API_KEY + "&language=" + language + "&region=il";
    https.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.status === "OK" && result.results.length > 0) {
            const r = result.results[0];
            const loc = r.geometry.location;
            resolve({ lat: loc.lat, lon: loc.lng, formatted: r.formatted_address, location_type: r.geometry.location_type });
          } else if (result.status === "OVER_QUERY_LIMIT") {
            reject(new Error("RATE_LIMITED"));
          } else { resolve(null); }
        } catch (e) { reject(new Error("PARSE_ERROR")); }
      });
    }).on("error", reject);
  });
}

function reverseGeocode(lat, lon, language) {
  return new Promise((resolve, reject) => {
    const url = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + lat + "," + lon + "&key=" + GOOGLE_API_KEY + "&language=" + language + "&region=il";
    https.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.status === "OK" && result.results.length > 0) { resolve(result.results[0].formatted_address); }
          else { resolve(null); }
        } catch (e) { reject(new Error("PARSE_ERROR")); }
      });
    }).on("error", reject);
  });
}

async function geocodeWithRetry(address, language, retries) {
  retries = retries || 3;
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await googleGeocode(address, language); }
    catch (e) {
      if (e.message === "RATE_LIMITED" || e.message === "PARSE_ERROR") {
        const wait = 2000 * (attempt + 1);
        console.log("    Retrying in " + (wait/1000) + "s (attempt " + (attempt+1) + "/" + retries + ")...");
        await sleep(wait);
      } else { throw e; }
    }
  }
  return null;
}

async function reverseGeocodeWithRetry(lat, lon, language, retries) {
  retries = retries || 3;
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await reverseGeocode(lat, lon, language); }
    catch (e) {
      if (e.message === "RATE_LIMITED" || e.message === "PARSE_ERROR") {
        const wait = 2000 * (attempt + 1);
        console.log("    Retrying reverse geocode in " + (wait/1000) + "s...");
        await sleep(wait);
      } else { throw e; }
    }
  }
  return null;
}

const publicShelters = ["רות 23","השופטים 6","הנביאים 10","יונה הנביא 8","דניאל 5","עמוס 6","לוי אשכול 8","שלמה המלך 4","יהודה המכבי 5","יהודה המכבי 2","שאול המלך 5","שאול המלך 19","התאנה 2","התאנה 12","החרוב 17","התמר 15","האילנות 23","הרימון 13","הרימון 7","הזית 6","הל\"ה 25","אלחריזי 15","יציאת אירופה 11","גרץ 10","שמחה אסף 13","הרב קוק 9","יבנה 3","הרב גולד 10","הסנהדרין 6","שפרינצק 12","חצרות הדר 12","מאפו 1","ניצנים 12","י. כהן 4","פרישמן 12","שבזי 32","קפלנסקי 3","קפלנסקי 1","יאנוש קורצ'ק 10","פרוג 6","ויתקין 13","לופמן 3","רמז 17","סירקין 13","חנה סנש 7","אנצ'ו סירני 17","מורדי הגטאות 22","ההגנה 9","חבצלת השרון 9","ההסתדרות 8","גורדון 19","איינשטיין 12","ויצמן 92","הגלבוע 8","אברהם קרן 31","הרצל 55","אסף שמחוני 9","המייסדים 31","המייסדים 7","נחשון 11","ויתקין 26"];

const miguniyot = ["המלך ינאי 1","לוי אשכול 39","הנביאים 33","הנביאים 4","ישעיהו 22","התותחנים 9","הר רביד 2","קפלנסקי 22","ישראל ישעיהו 14","יואל 17","לוי אשכול 45"];

const schools = [{"school":"בי\"ס אוסישקין","address":"רוטשילד 2"},{"school":"בי\"ס אופירה נבון","address":"עובדיה הנביא 2"},{"school":"בי\"ס אורנה פורת","address":"זטלר 5"},{"school":"בי\"ס בן גוריון","address":"צביה לובטקין"},{"school":"בי\"ס בר אילן","address":"בר אילן 2"},{"school":"בי\"ס ברנר","address":"זאב גלר 2"},{"school":"בי\"ס גולדה","address":"השלום 11"},{"school":"בי\"ס גורדון","address":"הגליל 48"},{"school":"בי\"ס דבורה עומר","address":"הזמיר 3"},{"school":"בי\"ס דמוקרטי חזן","address":"תרי עשר 24"},{"school":"בי\"ס חב\"ד","address":"יערה 13"},{"school":"בי\"ס יצחק שדה","address":"הגדוד העברי 3"},{"school":"בי\"ס לאה גולדברג","address":"ספיר 20"},{"school":"בי\"ס מונטסורי","address":"תרי עשר 24"},{"school":"בי\"ס סאדברי","address":"תרי עשר 24"},{"school":"בי\"ס סורקיס","address":"לוינסקי 4"},{"school":"בי\"ס רחל המשוררת","address":"עופרה חזה 1"},{"school":"בי\"ס רמז","address":"אלי הורוביץ 23"},{"school":"בי\"ס ש\"י עגנון","address":"ספיר 6"},{"school":"בי\"ס שילה","address":"גאולה 30"},{"school":"בי\"ס שמעון פרס","address":"יאיר רוזנבלום 29"},{"school":"חווה חקלאית","address":"תרי עשר 24"},{"school":"אולפנית הראל","address":"תל חי 70"},{"school":"חט\"ב אילן רמון","address":"אז\"ר 18"},{"school":"חט\"ב אלון","address":"גלר 6"},{"school":"חט\"ב בר לב","address":"תל חי 102"},{"school":"חט\"ב יורם טהרלב","address":"נעמי שמר 4"},{"school":"חט\"ב שז\"ר","address":"גלר 27"},{"school":"חט\"ב שרת","address":"גלר 29"},{"school":"תורה ומדע זבולון המר","address":"תל חי 87"},{"school":"תיכון גלילי","address":"אז\"ר 41"},{"school":"תיכון הרצוג","address":"אז\"ר 49"},{"school":"תיכון כצנלסון","address":"אז\"ר 43"},{"school":"תיכון מפתן","address":"בר אילן 37"},{"school":"תיכון רבין","address":"החיש 9"},{"school":"תיכון שמיר","address":"אלקלעי 1"},{"school":"בי\"ס גוונים","address":"תל חי 68"},{"school":"בי\"ס סאלד","address":"בר אילן 35"},{"school":"בי\"ס קשת","address":"נעמי שמר 1"}];


const entries = [];
for (const addr of publicShelters) {
  entries.push({ geocodeQuery: addr + " כפר סבא", name: "מקלט - " + addr, address: addr + ", כפר סבא", type: "מקלט ציבורי", category: "public" });
}
for (const addr of miguniyot) {
  entries.push({ geocodeQuery: addr + " כפר סבא", name: "מיגונית - " + addr, address: addr + ", כפר סבא", type: "מיגונית", category: "public" });
}
for (const sc of schools) {
  entries.push({ geocodeQuery: sc.address + " כפר סבא", name: "מקלט " + sc.school, address: sc.address + ", כפר סבא", type: "מקלט בית ספרי", category: "school" });
}

console.log("Total entries to geocode: " + entries.length);

function isInBounds(lat, lon) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax;
}
function coordKey(lat, lon) { return lat.toFixed(5) + "_" + lon.toFixed(5); }
function shortenEnAddress(full) {
  if (!full) return "";
  let s = full.replace(/, Israel$/i, "").trim();
  s = s.replace(/,?s*d{5,7}s*$/, "").trim();
  s = s.replace(/,s*$/, "").trim();
  return s;
}

async function main() {
  const results = [];
  let ok = 0, fail = 0, filtered = 0, dupes = 0;
  const seenCoords = new Set();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const label = "[" + (i+1) + "/" + entries.length + "]";
    try {
      const geo = await geocodeWithRetry(e.geocodeQuery, "he");
      if (!geo) { fail++; console.log("  " + label + " FAIL " + e.name + " (" + e.geocodeQuery + ") - not found"); await sleep(50); continue; }
      if (geo.location_type === "APPROXIMATE") { filtered++; console.log("  " + label + " FILTERED " + e.name + " - location_type APPROXIMATE"); await sleep(50); continue; }
      if (!isInBounds(geo.lat, geo.lon)) { filtered++; console.log("  " + label + " FILTERED " + e.name + " - outside bounds (" + geo.lat + ", " + geo.lon + ")"); await sleep(50); continue; }
      const key = coordKey(geo.lat, geo.lon);
      if (seenCoords.has(key)) { dupes++; console.log("  " + label + " DUPE " + e.name + " - duplicate coords (" + geo.lat + ", " + geo.lon + ")"); await sleep(50); continue; }
      seenCoords.add(key);
      await sleep(50);
      const enFull = await reverseGeocodeWithRetry(geo.lat, geo.lon, "en");
      const addressEn = shortenEnAddress(enFull);
      await sleep(50);
      results.push({ id: "kfarsaba_" + (results.length + 1), lat: geo.lat, lon: geo.lon, name: e.name, address: e.address, city: "כפר סבא", neighborhood: "", type: e.type, source: "gov", category: e.category, addressEn: addressEn });
      ok++;
      console.log("  " + label + " OK " + e.name + " -> " + geo.lat + ", " + geo.lon + " | " + addressEn);
    } catch (err) { fail++; console.log("  " + label + " ERROR " + e.name + " - " + err.message); }
    await sleep(50);
  }
  results.forEach(function(r, idx) { r.id = "kfarsaba_" + (idx + 1); });
  const outPath = path.join(__dirname, "..", "data", "kfar-saba-shelters.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
  console.log("");
  console.log("Done!");
  console.log("  Geocoded OK: " + ok);
  console.log("  Failed: " + fail);
  console.log("  Filtered (APPROXIMATE/out-of-bounds): " + filtered);
  console.log("  Duplicates: " + dupes);
  console.log("  Total saved: " + results.length);
  console.log("  Output: " + outPath);
}
main().catch(function(e) { console.error(e); process.exit(1); });
