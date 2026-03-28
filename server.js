'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3002;

/* ────────────────────────────────────────────
   City SEO data (slug → { he, en, lat, lon })
   ──────────────────────────────────────────── */
const CITY_SEO = {
  'tel-aviv':       { he: '\u05EA\u05DC \u05D0\u05D1\u05D9\u05D1',       en: 'Tel Aviv',       lat: 32.0853, lon: 34.7818 },
  'jerusalem':      { he: '\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD',      en: 'Jerusalem',      lat: 31.7683, lon: 35.2137 },
  'haifa':          { he: '\u05D7\u05D9\u05E4\u05D4',          en: 'Haifa',          lat: 32.7940, lon: 34.9896 },
  'beer-sheva':     { he: '\u05D1\u05D0\u05E8 \u05E9\u05D1\u05E2',     en: 'Beer Sheva',     lat: 31.2518, lon: 34.7913 },
  'herzliya':       { he: '\u05D4\u05E8\u05E6\u05DC\u05D9\u05D4',       en: 'Herzliya',       lat: 32.1629, lon: 34.8445 },
  'kfar-saba':      { he: '\u05DB\u05E4\u05E8 \u05E1\u05D1\u05D0',      en: 'Kfar Saba',      lat: 32.1780, lon: 34.9068 },
  'petah-tikva':    { he: '\u05E4\u05EA\u05D7 \u05EA\u05E7\u05D5\u05D5\u05D4',    en: 'Petah Tikva',    lat: 32.0841, lon: 34.8878 },
  'ashkelon':       { he: '\u05D0\u05E9\u05E7\u05DC\u05D5\u05DF',       en: 'Ashkelon',       lat: 31.6688, lon: 34.5743 },
  'holon':          { he: '\u05D7\u05D5\u05DC\u05D5\u05DF',          en: 'Holon',          lat: 32.0114, lon: 34.7748 },
  'netanya':        { he: '\u05E0\u05EA\u05E0\u05D9\u05D4',        en: 'Netanya',        lat: 32.3215, lon: 34.8532 },
  'bat-yam':        { he: '\u05D1\u05EA \u05D9\u05DD',        en: 'Bat Yam',        lat: 32.0236, lon: 34.7505 },
  'ashdod':         { he: '\u05D0\u05E9\u05D3\u05D5\u05D3',         en: 'Ashdod',         lat: 31.8040, lon: 34.6553 },
  'rehovot':        { he: '\u05E8\u05D7\u05D5\u05D1\u05D5\u05EA',        en: 'Rehovot',        lat: 31.8928, lon: 34.8113 },
  'rishon-lezion':  { he: '\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF',  en: 'Rishon LeZion',  lat: 31.9730, lon: 34.7925 },
  'ramat-gan':      { he: '\u05E8\u05DE\u05EA \u05D2\u05DF',      en: 'Ramat Gan',      lat: 32.0700, lon: 34.8236 },
  'givatayim':      { he: '\u05D2\u05D1\u05E2\u05EA\u05D9\u05D9\u05DD',      en: 'Givatayim',      lat: 32.0717, lon: 34.8124 },
  'bnei-brak':      { he: '\u05D1\u05E0\u05D9 \u05D1\u05E8\u05E7',      en: 'Bnei Brak',      lat: 32.0833, lon: 34.8333 },
  'or-yehuda':      { he: '\u05D0\u05D5\u05E8 \u05D9\u05D4\u05D5\u05D3\u05D4',      en: 'Or Yehuda',      lat: 32.0286, lon: 34.8558 },
  'kfar-yona':      { he: '\u05DB\u05E4\u05E8 \u05D9\u05D5\u05E0\u05D4',      en: 'Kfar Yona',      lat: 32.3167, lon: 34.9333 },
  'kiryat-ono':     { he: '\u05E7\u05E8\u05D9\u05EA \u05D0\u05D5\u05E0\u05D5',     en: 'Kiryat Ono',     lat: 32.0636, lon: 34.8553 },
  'dimona':         { he: '\u05D3\u05D9\u05DE\u05D5\u05E0\u05D4',         en: 'Dimona',         lat: 31.0700, lon: 35.0333 },
  'nesher':         { he: '\u05E0\u05E9\u05E8',         en: 'Nesher',         lat: 32.7706, lon: 35.0442 },
  'nahariya':       { he: '\u05E0\u05D4\u05E8\u05D9\u05D4',       en: 'Nahariya',       lat: 33.0061, lon: 35.0956 },
  'yehud':          { he: '\u05D9\u05D4\u05D5\u05D3',          en: 'Yehud',          lat: 32.0339, lon: 34.8855 },
};

/* ────────────────────────────────────────────
   Load the React app HTML template once
   ──────────────────────────────────────────── */
let templateHtml = '';
try {
  templateHtml = fs.readFileSync(
    path.join(__dirname, 'public', 'app', 'index.html'),
    'utf-8'
  );
} catch (err) {
  console.error('Warning: could not read public/app/index.html \u2014 city SEO pages will not work until the React app is built.');
}

/* ────────────────────────────────────────────
   cityHtml(slug) — returns HTML with injected
   city-specific SEO meta tags
   ──────────────────────────────────────────── */
function cityHtml(slug) {
  const city = CITY_SEO[slug];
  if (!city || !templateHtml) return templateHtml;

  const titleText  = '\u05DE\u05E7\u05DC\u05D8\u05D9\u05DD \u05D1' + city.he + ' | \u05DE\u05D0\u05EA\u05E8 \u05DE\u05E7\u05DC\u05D8\u05D9\u05DD \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9\u05D9\u05DD';
  const descText   = '\u05DE\u05E6\u05D0\u05D5 \u05DE\u05E7\u05DC\u05D8\u05D9\u05DD \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9\u05D9\u05DD \u05D1' + city.he + '. \u05DE\u05E4\u05EA \u05DE\u05E7\u05DC\u05D8\u05D9\u05DD \u05E2\u05DD \u05E0\u05D9\u05D5\u05D5\u05D8 \u05D1-Waze \u05D5-Google Maps.';
  const canonical  = 'https://shelter-finder.com/shelters/' + slug;

  let html = templateHtml;

  // Replace title
  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + titleText + '</title>');

  // Remove generic meta tags that will be replaced with city-specific ones
  html = html.replace(/<meta name="description"[^>]*\/?>\s*/g, '');
  html = html.replace(/<link rel="canonical"[^>]*\/?>\s*/g, '');
  html = html.replace(/<meta property="og:title"[^>]*\/?>\s*/g, '');
  html = html.replace(/<meta property="og:description"[^>]*\/?>\s*/g, '');
  html = html.replace(/<meta property="og:url"[^>]*\/?>\s*/g, '');
  html = html.replace(/<meta property="og:type"[^>]*\/?>\s*/g, '');
  html = html.replace(/<meta name="twitter:card"[^>]*\/?>\s*/g, '');
  html = html.replace(/<meta name="twitter:title"[^>]*\/?>\s*/g, '');
  html = html.replace(/<meta name="twitter:description"[^>]*\/?>\s*/g, '');

  // Inject city-specific meta tags
  const metaTags = [
    '<meta name="description" content="' + descText + '" />',
    '<link rel="canonical" href="' + canonical + '" />',
    '<meta property="og:title" content="' + titleText + '" />',
    '<meta property="og:description" content="' + descText + '" />',
    '<meta property="og:url" content="' + canonical + '" />',
    '<meta property="og:type" content="website" />',
    '<meta name="twitter:card" content="summary" />',
    '<meta name="twitter:title" content="' + titleText + '" />',
    '<meta name="twitter:description" content="' + descText + '" />',
    '<meta name="city-data" content="' + slug + '" data-lat="' + city.lat + '" data-lon="' + city.lon + '" data-he="' + city.he + '" />',
  ].join('\n    ');

  html = html.replace('</head>', '    ' + metaTags + '\n  </head>');

  return html;
}

/* ────────────────────────────────────────────
   Middleware
   ──────────────────────────────────────────── */

// Prevent browsers from caching HTML — always revalidate with server
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path.startsWith('/shelters/')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

/* ────────────────────────────────────────────
   Routes
   ──────────────────────────────────────────── */

// API routes
app.use('/api', require('./src/routes/api'));

// Redirect /app and /app/ to root (avoid duplicate content for SEO)
app.get('/app', (_req, res) => res.redirect(301, '/'));
app.get('/app/', (_req, res) => res.redirect(301, '/'));

// City-specific SEO pages
app.get('/shelters/:city', (req, res) => {
  const slug = req.params.city.toLowerCase();
  const html = cityHtml(slug);
  if (html) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.type('html').send(html);
  } else {
    // Unknown city — fall back to generic React app
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
  }
});

// Catch-all: serve React app for all other routes
app.get('*', (_req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});

/* ────────────────────────────────────────────
   Startup
   ──────────────────────────────────────────── */
const { warmCaches } = require('./src/startup');
warmCaches();

const { initFirebase } = require('./src/services/firebase');
const alertMonitor = require('./src/alert-monitor');

initFirebase();

app.listen(PORT, () => {
  console.log('\n\u{1F6D6}\uFE0F  Shelter Finder running on http://localhost:' + PORT + '\n');
  alertMonitor.start();
});
