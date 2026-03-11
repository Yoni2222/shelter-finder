'use strict';
const fetch = require('node-fetch');

/**
 * Fetch ALL features from an ArcGIS FeatureServer or MapServer layer.
 * Returns raw features array with {attributes, geometry} objects.
 */
async function fetchAllArcGIS(url, { outFields = '*', outSR = '4326', timeout = 20000, extraParams = {} } = {}) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields,
    outSR,
    returnGeometry: 'true',
    resultRecordCount: '2000',
    f: 'json',
    ...extraParams,
  });
  const res = await fetch(`${url}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const json = await res.json();
  if (json.error) throw new Error(`ArcGIS error: ${json.error.message}`);
  return json.features || [];
}

module.exports = { fetchAllArcGIS };
