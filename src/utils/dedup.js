'use strict';

const haversine = require('./haversine');

// Check if two shelter names share a significant word
function shareName(a, b) {
  if (!a || !b) return false;
  // Extract significant words (3+ chars), ignoring common prefixes
  const skip = new Set(['\u05DE\u05E7\u05DC\u05D8','\u05DE\u05E8\u05D7\u05D1','\u05DE\u05D5\u05D2\u05DF','\u05E6\u05D9\u05D1\u05D5\u05E8\u05D9','\u05D1\u05D9\u05EA','\u05E1\u05E4\u05E8','public','shelter']);
  const words = s => s.replace(/[#\d"]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !skip.has(w));
  const wa = words(a), wb = words(b);
  return wa.some(w => wb.some(w2 => w === w2 || w.includes(w2) || w2.includes(w)));
}

// Deduplicate shelters within a single list (prefer gov/arcgis over OSM)
function deduplicate(shelters, thresholdKm = 0.05) {
  const out = [];
  for (const s of shelters) {
    const dup = out.find(x => haversine(x.lat, x.lon, s.lat, s.lon) < thresholdKm);
    if (!dup) {
      out.push(s);
    } else if (s.source === 'gov' || s.source === 'arcgis') {
      Object.assign(dup, { ...s, id: dup.id });
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
      haversine(x.lat, x.lon, s.lat, s.lon) < 0.1 && shareName(x.name, s.name)
    );
    if (!dup) {
      final.push(s);
    } else if (s.source === 'gov' || s.source === 'arcgis') {
      Object.assign(dup, { ...s, id: dup.id });
    }
  }
  // Phase 3: tight proximity dedup (30m) across all categories, regardless of name
  // Catches same physical shelter from different sources with different names
  const final2 = [];
  for (const s of final) {
    const dup = final2.find(x =>
      haversine(x.lat, x.lon, s.lat, s.lon) < 0.03
    );
    if (!dup) {
      final2.push(s);
    } else if (s.source === 'gov' || s.source === 'arcgis') {
      Object.assign(dup, { ...s, id: dup.id });
    }
  }
  return final2;
}

module.exports = { deduplicate, deduplicateAll, shareName };
