'use strict';

// Hebrew article prefix retry — many Israeli streets have "\u05D4" prefix users omit
function addHebrewArticle(q) {
  const words = q.trim().split(/\s+/);
  if (words.length < 2) return null;
  const first = words[0];
  // Skip if already starts with \u05D4 or if it's a number
  if (first.startsWith('\u05D4') || /^\d/.test(first)) return null;
  // Skip common Hebrew names that shouldn't get \u05D4 prefix
  const skipWords = new Set(['\u05D1\u05DF', '\u05D1\u05E8', '\u05E8\u05D1\u05D9', '\u05D0\u05D1\u05DF', '\u05D1\u05D9\u05EA', '\u05D2\u05DF', '\u05E9\u05D3', '\u05D3\u05E8\u05DA', '\u05DB\u05D9\u05DB\u05E8']);
  if (skipWords.has(first)) return null;
  words[0] = '\u05D4' + first;
  return words.join(' ');
}

// Default name for OSM shelters
function osmDefaultName(t) {
  if (t['shelter_type'] === 'bomb_shelter')   return '\u05DE\u05E7\u05DC\u05D8 \u05E4\u05E6\u05E6\u05D5\u05EA';
  if (t['shelter_type'] === 'public_shelter') return '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9';
  if (t['building']      === 'shelter')       return '\u05DE\u05E7\u05DC\u05D8';
  if (t['emergency']     === 'shelter')       return '\u05DE\u05E7\u05DC\u05D8 \u05D7\u05D9\u05E8\u05D5\u05DD';
  return '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9';
}

module.exports = { addHebrewArticle, osmDefaultName };
