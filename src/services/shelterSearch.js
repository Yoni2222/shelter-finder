'use strict';

// Find shelters matching a street name in the address query (city-filtered)
function findSheltersByAddress(query, allShelters) {
  const cityMap = {
    '\u05DB\u05E4\u05E8 \u05E1\u05D1\u05D0': '\u05DB\u05E4\u05E8 \u05E1\u05D1\u05D0', '\u05DB\u05E4"\u05E1': '\u05DB\u05E4\u05E8 \u05E1\u05D1\u05D0', '\u05DB\u05E4\u05F4\u05E1': '\u05DB\u05E4\u05E8 \u05E1\u05D1\u05D0',
    '\u05D4\u05E8\u05E6\u05DC\u05D9\u05D4': '\u05D4\u05E8\u05E6\u05DC\u05D9\u05D4', '\u05D7\u05D5\u05DC\u05D5\u05DF': '\u05D7\u05D5\u05DC\u05D5\u05DF',
    '\u05EA\u05DC \u05D0\u05D1\u05D9\u05D1': '\u05EA\u05DC \u05D0\u05D1\u05D9\u05D1', '\u05D7\u05D9\u05E4\u05D4': '\u05D7\u05D9\u05E4\u05D4', '\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD': '\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD',
    '\u05D1\u05D0\u05E8 \u05E9\u05D1\u05E2': '\u05D1\u05D0\u05E8 \u05E9\u05D1\u05E2', '\u05D0\u05E9\u05D3\u05D5\u05D3': '\u05D0\u05E9\u05D3\u05D5\u05D3', '\u05D0\u05E9\u05E7\u05DC\u05D5\u05DF': '\u05D0\u05E9\u05E7\u05DC\u05D5\u05DF',
    '\u05E0\u05EA\u05E0\u05D9\u05D4': '\u05E0\u05EA\u05E0\u05D9\u05D4', '\u05E4\u05EA\u05D7 \u05EA\u05E7\u05D5\u05D5\u05D4': '\u05E4\u05EA\u05D7 \u05EA\u05E7\u05D5\u05D5\u05D4', '\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF': '\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF',
    '\u05D1\u05EA \u05D9\u05DD': '\u05D1\u05EA \u05D9\u05DD', '\u05D1\u05E0\u05D9 \u05D1\u05E8\u05E7': '\u05D1\u05E0\u05D9 \u05D1\u05E8\u05E7', '\u05E8\u05DE\u05EA \u05D2\u05DF': '\u05E8\u05DE\u05EA \u05D2\u05DF',
    '\u05D2\u05D1\u05E2\u05EA\u05D9\u05D9\u05DD': '\u05D2\u05D1\u05E2\u05EA\u05D9\u05D9\u05DD', '\u05E8\u05D7\u05D5\u05D1\u05D5\u05EA': '\u05E8\u05D7\u05D5\u05D1\u05D5\u05EA', '\u05E8\u05D0\u05E9 \u05D4\u05E2\u05D9\u05DF': '\u05E8\u05D0\u05E9 \u05D4\u05E2\u05D9\u05DF',
    '\u05D9\u05D4\u05D5\u05D3': '\u05D9\u05D4\u05D5\u05D3', '\u05D9\u05D4\u05D5\u05D3 \u05DE\u05D5\u05E0\u05D5\u05E1\u05D5\u05DF': '\u05D9\u05D4\u05D5\u05D3', '\u05D0\u05D5\u05E8 \u05D9\u05D4\u05D5\u05D3\u05D4': '\u05D0\u05D5\u05E8 \u05D9\u05D4\u05D5\u05D3\u05D4', '\u05DB\u05E4\u05E8 \u05D9\u05D5\u05E0\u05D4': '\u05DB\u05E4\u05E8 \u05D9\u05D5\u05E0\u05D4',
    '\u05E7\u05E8\u05D9\u05EA \u05D0\u05D5\u05E0\u05D5': '\u05E7\u05E8\u05D9\u05EA \u05D0\u05D5\u05E0\u05D5', '\u05D3\u05D9\u05DE\u05D5\u05E0\u05D4': '\u05D3\u05D9\u05DE\u05D5\u05E0\u05D4', '\u05E0\u05E9\u05E8': '\u05E0\u05E9\u05E8', '\u05E0\u05D4\u05E8\u05D9\u05D4': '\u05E0\u05D4\u05E8\u05D9\u05D4',
    'אילת': 'אילת',
    'מודיעין עילית': 'מודיעין עילית',
    'מודיעין-מכבים-רעות': 'מודיעין-מכבים-רעות', 'מודיעין מכבים רעות': 'מודיעין-מכבים-רעות',
    'מודיעין': 'מודיעין-מכבים-רעות', 'רעות': 'מודיעין-מכבים-רעות', 'מכבים': 'מודיעין-מכבים-רעות',
    'עפולה': 'עפולה',
    'חדרה': 'חדרה',
    'קריית שמונה': 'קריית שמונה', 'קרית שמונה': 'קריית שמונה',
    'עתלית': 'עתלית',
    'בית שמש': 'בית שמש',
    'רמלה': 'רמלה',
    'לוד': 'לוד',
    'רעננה': 'רעננה',
    'עכו': 'עכו',
    'הוד השרון': 'הוד השרון', 'הוד-השרון': 'הוד השרון',
    'רמת השרון': 'רמת השרון', 'רמת-השרון': 'רמת השרון',
    'קריית אתא': 'קריית אתא', 'קרית אתא': 'קריית אתא',
    'קריית ים': 'קריית ים', 'קרית ים': 'קריית ים',
    'קריית ביאליק': 'קריית ביאליק', 'קרית ביאליק': 'קריית ביאליק',
    'קריית מוצקין': 'קריית מוצקין', 'קרית מוצקין': 'קריית מוצקין',
  };

  // Detect city from query
  let detectedCity = null;
  let street = query.trim();
  // Sort city names longest-first to match "\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF" before "\u05E8\u05D0\u05E9\u05D5\u05DF"
  const cityKeys = Object.keys(cityMap).sort((a, b) => b.length - a.length);
  for (const key of cityKeys) {
    if (street.includes(key)) {
      detectedCity = cityMap[key];
      street = street.replace(new RegExp(key, 'g'), '').trim();
      break;
    }
  }

  // Clean up: remove commas, extra whitespace
  street = street.replace(/^[,\s]+|[,\s]+$/g, '').trim();
  if (street.length < 2) return [];

  // Extract street name without house number
  const streetOnly = street.replace(/\s+\d+\s*$/, '').trim();
  if (streetOnly.length < 2) return [];

  // Build street name variants — handle Hebrew "\u05D4" definite article prefix
  // Users may search "\u05D4\u05D2\u05D1\u05D5\u05E8\u05D5\u05EA" but data has "\u05D2\u05D1\u05D5\u05E8\u05D5\u05EA", or vice versa
  const streetVariants = [streetOnly];
  if (streetOnly.startsWith('\u05D4') && streetOnly.length > 2) {
    streetVariants.push(streetOnly.slice(1)); // strip \u05D4
  }
  if (!streetOnly.startsWith('\u05D4') && !/^\d/.test(streetOnly)) {
    streetVariants.push('\u05D4' + streetOnly); // add \u05D4
  }

  // Vav (ו) spelling variants: "דוב" ↔ "דב"
  const withoutVav = streetOnly.replace(/ו/g, '');
  if (withoutVav !== streetOnly && withoutVav.length >= 2) streetVariants.push(withoutVav);

  // Alef (א) spelling variants: "דיזראעלי" ↔ "דיזרעלי"
  const withoutAlef = streetOnly.replace(/א/g, '');
  if (withoutAlef !== streetOnly && withoutAlef.length >= 2) streetVariants.push(withoutAlef);

  // Build regex for each variant
  const streetRegexes = streetVariants.map(variant => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|\\s)' + escaped + '(\\s|\\d|,|$)');
  });

  // Filter shelters by city AND street name
  const matches = allShelters.filter(s => {
    if (!s.address) return false;
    // City filter: if we detected a city, shelter must be in that city
    // Check both s.city field AND the address string for the city name
    if (detectedCity) {
      const inCity = (s.city && s.city === detectedCity) || s.address.includes(detectedCity);
      if (!inCity) return false;
    }
    // Street match: try all variants (with/without \u05D4 prefix)
    return streetRegexes.some(re => re.test(s.address) || re.test(s.name));
  });

  return matches.slice(0, 20);
}

module.exports = { findSheltersByAddress };
