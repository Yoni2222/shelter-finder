'use strict';

const haversine = require('./haversine');

// Check if two shelter names share a significant word
function shareName(a, b) {
  if (!a || !b) return false;
  const skip = new Set(['מקלט','מרחב','מוגן','ציבורי','בית','ספר','public','shelter']);
  const words = s => s.replace(/[#\d"]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !skip.has(w));
  const wa = words(a), wb = words(b);
  return wa.some(w => wb.some(w2 => w === w2 || w.includes(w2) || w2.includes(w)));
}

// Check if two shelters have different addresses (different physical locations)
function hasDifferentAddress(a, b) {
  const addrA = (a.address || '').trim();
  const addrB = (b.address || '').trim();
  // If both have addresses: same address = same shelter, different = different shelter
  if (addrA && addrB) return addrA !== addrB;
  // Fallback to name comparison only when addresses are missing
  const nameA = (a.name || '').trim();
  const nameB = (b.name || '').trim();
  if (nameA && nameB) return nameA !== nameB;
  return false;
}

// Deduplicate shelters within a single list (prefer gov/arcgis over OSM)
// IMPORTANT: never mutate original objects — always clone
function deduplicate(shelters, thresholdKm = 0.05) {
  const out = [];
  for (const s of shelters) {
    const dup = out.find(x => haversine(x.lat, x.lon, s.lat, s.lon) < thresholdKm && !hasDifferentAddress(x, s));
    if (!dup) {
      out.push({ ...s });
    } else if (s.source === 'gov' || s.source === 'arcgis') {
      // Clone: replace dup entry with merged copy (never mutate originals)
      const idx = out.indexOf(dup);
      out[idx] = { ...s, id: dup.id };
    }
  }
  return out;
}

// Deduplicate: first per-category (50m), then cross-category for similar names (100m)
function deduplicateAll(shelters) {
  // Phase 1: per-category dedup at 50m
  const byCategory = {};
  for (const s of shelters) {
    const cat = s.category || 'public';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  }
  let result = [];
  for (const list of Object.values(byCategory)) {
    result.push(...deduplicate(list));
  }
  // Phase 2: cross-category dedup — if two shelters within 100m share a name keyword, keep gov
  const final = [];
  for (const s of result) {
    const dup = final.find(x =>
      haversine(x.lat, x.lon, s.lat, s.lon) < 0.1 && shareName(x.name, s.name) && !hasDifferentAddress(x, s)
    );
    if (!dup) {
      final.push(s);
    } else if (s.source === 'gov' || s.source === 'arcgis') {
      const idx = final.indexOf(dup);
      final[idx] = { ...s, id: dup.id };
    }
  }
  // Phase 3: tight proximity dedup (30m) across all categories
  // Only merge if both shelters have the same address (or one lacks an address).
  // Shelters with different addresses at the same coordinates are KEPT.
  const final2 = [];
  for (const s of final) {
    const dup = final2.find(x =>
      haversine(x.lat, x.lon, s.lat, s.lon) < 0.03 && !hasDifferentAddress(x, s)
    );
    if (!dup) {
      final2.push(s);
    } else if (s.source === 'gov' || s.source === 'arcgis') {
      const idx = final2.indexOf(dup);
      final2[idx] = { ...s, id: dup.id };
    }
  }
  return final2;
}

module.exports = { deduplicate, deduplicateAll, shareName };
