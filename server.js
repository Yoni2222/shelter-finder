'use strict';

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3002;

// Prevent browsers from caching HTML \u2014 always revalidate with server
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', require('./src/routes/api'));

// Production: serve built React app for all non-API routes
app.get('*', (_req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});

// Pre-warm caches on startup
const { warmCaches } = require('./src/startup');
warmCaches();

// Start
app.listen(PORT, () => {
  console.log(`\n\uD83C\uDFDA\uFE0F  Shelter Finder running on http://localhost:${PORT}\n`);
});
