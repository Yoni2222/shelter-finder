/**
 * Extract public shelter data for Sderot from GovMap's GeoServer.
 *
 * GeoServer endpoint: https://www.govmap.gov.il/api/geoserver/ows/public/
 * Layer: govmap:layer_bombshelters
 * CRS: EPSG:3857 (Web Mercator)
 *
 * WFS is disabled. WMS GetFeatureInfo works but is point-based.
 * Strategy: use a single large BBOX covering Sderot, with a large image,
 * and systematically query different I,J pixel coordinates across the image.
 * Each query returns features near that pixel. We deduplicate by objectid.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Web Mercator (EPSG:3857) to WGS84 ──
function mercatorToWgs84(x, y) {
  const lon = (x / 20037508.342789244) * 180;
  let lat = (y / 20037508.342789244) * 180;
  lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
  return { lat, lon };
}

// ── WGS84 to Web Mercator (EPSG:3857) ──
function wgs84ToMercator(lat, lon) {
  const x = lon * 20037508.342789244 / 180;
  const yRad = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
  const y = yRad * 20037508.342789244 / 180;
  return { x, y };
}

// ── HTTP fetch helper ──
function fetch(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, */*',
        'Origin': 'https://www.govmap.gov.il',
        'Referer': 'https://www.govmap.gov.il/',
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== GovMap Sderot Shelter Extraction ===\n');

  // Sderot WGS84 bounding box (generous)
  const bbox = {
    latMin: 31.515,
    lonMin: 34.570,
    latMax: 31.550,
    lonMax: 34.615,
  };

  // Convert to EPSG:3857
  const sw = wgs84ToMercator(bbox.latMin, bbox.lonMin);
  const ne = wgs84ToMercator(bbox.latMax, bbox.lonMax);

  const geoserverBase = 'https://www.govmap.gov.il/api/geoserver/ows/public/';
  const layerName = 'govmap:layer_bombshelters';

  // Use a large image so each pixel = ~10m
  // Sderot area is about 5000m x 4500m in mercator
  const rangeX = ne.x - sw.x; // ~5009m
  const rangeY = ne.y - sw.y; // ~4571m

  // Image: 500 x 460 pixels -> ~10m per pixel
  const imgW = 500;
  const imgH = Math.round(imgW * rangeY / rangeX);
  const metersPerPixel = rangeX / imgW;

  console.log(`BBOX range: ${rangeX.toFixed(0)}m x ${rangeY.toFixed(0)}m`);
  console.log(`Image: ${imgW} x ${imgH} pixels`);
  console.log(`Resolution: ${metersPerPixel.toFixed(1)}m per pixel`);

  const bboxStr = `${sw.x},${sw.y},${ne.x},${ne.y}`;

  // Scan with a step of ~30 pixels = ~300m
  // GetFeatureInfo seems to have a tolerance of maybe 10-20 pixels
  const step = 15; // pixels
  const allFeatures = new Map();
  let requestCount = 0;

  const iSteps = Math.ceil(imgW / step);
  const jSteps = Math.ceil(imgH / step);
  const totalRequests = iSteps * jSteps;

  console.log(`Scan step: ${step}px = ${(step * metersPerPixel).toFixed(0)}m`);
  console.log(`Grid: ${iSteps} x ${jSteps} = ${totalRequests} queries\n`);

  for (let ii = 0; ii < imgW; ii += step) {
    for (let jj = 0; jj < imgH; jj += step) {
      const params = new URLSearchParams({
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        REQUEST: 'GetFeatureInfo',
        FORMAT: 'image/png',
        TRANSPARENT: 'true',
        LAYERS: layerName,
        QUERY_LAYERS: layerName,
        INFO_FORMAT: 'application/json',
        FEATURE_COUNT: '100',
        CRS: 'EPSG:3857',
        WIDTH: String(imgW),
        HEIGHT: String(imgH),
        I: String(ii),
        J: String(jj),
        BBOX: bboxStr,
        BUFFER: '10',
      });

      const url = geoserverBase + '?' + params.toString();

      try {
        const r = await fetch(url);
        requestCount++;

        if (r.status === 200 && r.data.trim().length > 2) {
          try {
            const json = JSON.parse(r.data);
            if (json.features && json.features.length > 0) {
              let newCount = 0;
              for (const f of json.features) {
                const oid = f.properties?.objectid;
                if (oid != null && !allFeatures.has(oid)) {
                  allFeatures.set(oid, f);
                  newCount++;
                }
              }
              if (newCount > 0) {
                process.stdout.write(`\r  [${requestCount}/${totalRequests}] +${newCount} new, total ${allFeatures.size} unique shelters`);
              }
            }
          } catch (e) { /* not JSON */ }
        }
      } catch (e) { /* network error */ }

      // Rate limiting
      if (requestCount % 10 === 0) {
        await sleep(50);
      }
    }

    // Progress on new column
    process.stdout.write(`\r  [${requestCount}/${totalRequests}] ${allFeatures.size} unique shelters found...      `);
  }

  console.log(`\n\nCompleted ${requestCount} requests.`);
  console.log(`Total unique shelters found: ${allFeatures.size}`);

  if (allFeatures.size === 0) {
    console.log('No shelters found.');
    return;
  }

  // Convert to output format
  const shelters = [];
  for (const [oid, f] of allFeatures) {
    const props = f.properties || {};
    let lat = null, lon = null;

    if (f.geometry && f.geometry.type === 'Point') {
      const [x, y] = f.geometry.coordinates;
      if (Math.abs(x) > 180) {
        const wgs = mercatorToWgs84(x, y);
        lat = Math.round(wgs.lat * 1000000) / 1000000;
        lon = Math.round(wgs.lon * 1000000) / 1000000;
      } else {
        lon = Math.round(x * 1000000) / 1000000;
        lat = Math.round(y * 1000000) / 1000000;
      }
    }

    shelters.push({
      id: oid,
      lat,
      lon,
      name: props.type_of_shelter_text || '',
      address: '',
      city: 'שדרות',
      neighborhood: '',
      type: 'מקלט ציבורי',
      source: 'govmap',
      category: 'public',
    });
  }

  // Sort by id
  shelters.sort((a, b) => a.id - b.id);

  console.log('\nSample shelters (first 10):');
  for (const s of shelters.slice(0, 10)) {
    console.log(`  objectid: ${s.id}, lat: ${s.lat}, lon: ${s.lon}, name: "${s.name}"`);
  }

  // Write output
  const outPath = path.join(__dirname, 'sderot-govmap-output.json');
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nResults written to: ${outPath}`);
  console.log(`Total: ${shelters.length} shelters`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
