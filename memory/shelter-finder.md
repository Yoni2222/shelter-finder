# Shelter Finder - Detailed Project Memory

## Overview
Public shelter finder for Israel. Bilingual (Hebrew/English) web app showing public shelters on an interactive map.

**Root:** `C:\Users\yonib\OneDrive\Desktop\JobSearch\shelter-finder\`
**Live URL:** https://shelter-finder.com
**Git:** https://github.com/Yoni2222/shelter-finder
**Deployment:** Koyeb (build: `npm install && npm run build`, run: `npm start`)

## Stack
- **Backend:** Node.js + Express + node-fetch (`server.js`)
- **Frontend:** React + TypeScript + Vite (`client/`)
- **Map:** Leaflet
- **Language:** Bilingual HE/EN (i18n in `client/src/i18n/`)
- **Data sources:** OSM Overpass API + 24 cities static JSON + Google Geocoding API

## Key Ports
- Backend: **3002**
- React client (dev): **5174**

## Project Structure
```
shelter-finder/
  server.js                  # Express backend
  package.json
  .env                       # Google API key
  .gitignore                 # includes scripts/, .env
  data/                      # 24 city JSON files (static shelter data)
  public/
    index.html               # Legacy HTML entry
    app/                     # Built React app output
  client/                    # React + TypeScript frontend
    src/
      App.tsx, main.tsx
      components/            # UI components
      context/               # React context providers
      hooks/                 # Custom hooks
      i18n/                  # Internationalization (HE/EN)
      styles/                # CSS
      types/                 # TypeScript types
  scripts/                   # Data build scripts (gitignored)
    build-*.js               # Per-city data builders
    geocode-*.js             # Geocoding scripts
    add-english-addresses.js
    fix-localize.js
    input/, lib/, scrape/
  temp/                      # Temporary files
  memory/                    # Project memory
```

## Data: 24 Cities, 2,914 Shelters

| City | Count | Source |
|------|-------|--------|
| Tel Aviv | 511 | Static JSON |
| Beer Sheva | 262 | Static JSON |
| Haifa | 216 | Static JSON |
| Jerusalem | 215 | Static JSON |
| Petah Tikva | 188 | Static JSON |
| Ashkelon | 175 | Static JSON |
| Nahariya | 157 | Static JSON |
| Ramat Gan | 126 | Static JSON |
| Rehovot | 126 | Static JSON |
| Kfar Saba | 189 | Static JSON (61 public + 11 miguniyot + 39 schools + 83 kindergartens) |
| Rosh HaAyin | 96 | Static JSON |
| Herzliya | 88 | Static JSON (switched from live GIS API) |
| Holon | 77 | Static JSON (switched from live GIS API) |
| Dimona | 73 | Static JSON |
| Bnei Brak | 59 | Static JSON |
| Ashdod | 58 | Static JSON |
| Netanya | 55 | Static JSON |
| Bat Yam | 55 | Static JSON |
| Or Yehuda | 53 | Static JSON |
| Yehud | 39 | Static JSON |
| Kiryat Ono | 31 | Static JSON |
| Kfar Yona | 24 | Static JSON |
| Nesher | 22 | Static JSON |
| Givatayim | 19 | Static JSON |

All shelters geocoded via Google Geocoding API. OSM Overpass used as supplementary source at runtime.

## Shelter Categories & Markers
- **Public shelters** - standard markers
- **School shelters** - purple markers (category: 'school')
- **Miguniyot** (safe rooms) - separate category

69 school shelters across 6 cities: category corrected from 'public' to 'school'.

## Key Features
- Interactive Leaflet map with clustered markers
- City search with autocomplete dropdown (arrow key navigation supported)
- Bilingual HE/EN with full English language support
- Shelter details: name, address, category, coordinates
- Holon generic names ("מקלט 1") display address as title instead
- Cache-control headers (no-cache for HTML responses)
- Deduplication: 50m threshold + cross-category name matching at 100m

## Environment
- `.env` file contains Google Geocoding API key
- `scripts/` directory is gitignored (contains data build/scrape utilities)

## Recent Changes (2026-03-13)
- Herzliya, Holon, Kfar Saba switched from live GIS APIs to static JSON caches
- 69 school shelters across 6 cities: category fixed from 'public' to 'school' (purple markers)
- Deduplication improved: 50m threshold + cross-category name matching at 100m
- Ashdod: 5 shelters with wrong city-level coordinates fixed
- Kfar Saba re-scraped from municipality URL: 106 shelters (was 123)
- Arrow key navigation added for autocomplete dropdown
- Cache-control headers added (no-cache for HTML responses)
- Holon generic names show address as title
- API key moved to .env file, scripts/ added to .gitignore
- Deployed to Koyeb at shelter-finder.com
- Kfar Saba: 83 kindergarten shelters added (189 total, was 106)

## Pending Issues
- Rabbi Akiva 7 Herzliya: shelter exists in data (76m from Nominatim result) but user reports not finding it - may need redeployment
- OSM results can show unrelated shelters at different locations from our data
- Yehud: issues deferred
- Nominatim geocoding lacks house-level precision for many Israeli streets (causes misleading distances for Bar Ilan 35/36, Rabbi Akiva 7, etc.)
- Holon: school/kindergarten shelters not available (municipality doesn't publish addresses)
