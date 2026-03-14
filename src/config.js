'use strict';

// ─────────────────────────────────────────────
// Known data.gov.il shelter resources (CSV/tabular via CKAN API)
// ─────────────────────────────────────────────
const GOV_RESOURCES = [
  {
    id: 'e191d913-11e4-4d87-a4b2-91587aab6611',
    city: '\u05D1\u05D0\u05E8 \u05E9\u05D1\u05E2',
    latField: 'lat',
    lonField: 'lon',
    nameField: 'name',
  },
];

// ─────────────────────────────────────────────
// GeoJSON shelter sources
// ─────────────────────────────────────────────
const GEOJSON_RESOURCES = [
  {
    url: 'https://jerusalem.datacity.org.il/dataset/3e97d0fc-4268-4aea-844d-12588f55d809/resource/b9bd9575-d431-4f9d-af4b-1413d3c13590/download/data.geojson',
    city: '\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD',
    nameField: '\u05DE\u05E1\u05E4\u05E8 \u05DE\u05E7\u05DC\u05D8',
  },
];

// ─────────────────────────────────────────────
// ArcGIS / Municipality URLs
// ─────────────────────────────────────────────
const PETAH_TIKVA_URL =
  'https://services9.arcgis.com/tfeLX7LFVABzD11G/arcgis/rest/services/' +
  '%D7%9E%D7%A8%D7%97%D7%91%D7%99%D7%9D/FeatureServer/0/query';

const YEHUD_ITEM_URL =
  'https://www.arcgis.com/sharing/rest/content/items/5ea507fd44a049dd9c9b4babf2ab0e3f/data?f=json';

const RISHON_URL =
  'https://www.rishonlezion.muni.il/Residents/SecurityEmergency/pages/publicshelter.aspx';

const HERZLIYA_URL =
  'https://services3.arcgis.com/9qGhZGtb39XMVQyR/arcgis/rest/services/' +
  '%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D_2025/FeatureServer/0/query';

const ASHKELON_URL =
  'https://services2.arcgis.com/5gNmRQS5QY72VLq4/ArcGIS/rest/services/' +
  'PUBLIC_SHELTER/FeatureServer/0/query';

const HOLON_URL =
  'https://services2.arcgis.com/cjDo9oPmimdHxumn/arcgis/rest/services/' +
  '%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D/FeatureServer/0/query';

const KFAR_SABA_URL =
  'https://services2.arcgis.com/CrAWtmFzBf9b3nM0/arcgis/rest/services/' +
  'HlsFacilities/FeatureServer/0/query';

const REHOVOT_URL =
  'https://services6.arcgis.com/U71MeVnZSuYULYvK/arcgis/rest/services/' +
  '%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D_%D7%A2%D7%9D_%D7%9B%D7%9C%D7%91%D7%99%D7%90_view/FeatureServer/0/query';

const ARCGIS_SHELTER_URL =
  'https://services-eu1.arcgis.com/1SaThKhnIOL6Cfhz/arcgis/rest/services/miklatim/FeatureServer/0';

const TEL_AVIV_SHELTER_URL =
  'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/592/query';

// ─────────────────────────────────────────────
// Cache TTLs
// ─────────────────────────────────────────────
const GOV_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MUNI_LIST_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const GEOCODE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const TEL_AVIV_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─────────────────────────────────────────────
// Municipality HTML list sources
// ─────────────────────────────────────────────
const MUNICIPALITY_LIST_SOURCES = [];

module.exports = {
  GOV_RESOURCES,
  GEOJSON_RESOURCES,
  PETAH_TIKVA_URL,
  YEHUD_ITEM_URL,
  RISHON_URL,
  HERZLIYA_URL,
  ASHKELON_URL,
  HOLON_URL,
  KFAR_SABA_URL,
  REHOVOT_URL,
  ARCGIS_SHELTER_URL,
  TEL_AVIV_SHELTER_URL,
  GOV_CACHE_TTL,
  MUNI_LIST_CACHE_TTL,
  GEOCODE_CACHE_TTL,
  TEL_AVIV_CACHE_TTL,
  MUNICIPALITY_LIST_SOURCES,
};
