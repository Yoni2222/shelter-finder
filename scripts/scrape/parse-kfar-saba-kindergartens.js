'use strict';
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const PAGE_URL = 'https://kfar-saba.muni.il/%D7%A8%D7%A9%D7%99%D7%9E%D7%AA-%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D-%D7%A2%D7%99%D7%A8%D7%95%D7%A0%D7%99%D7%99%D7%9D-%D7%91%D7%9B%D7%A4%D7%A8-%D7%A1%D7%91%D7%90/';

/**
 * Scrape kindergarten shelter addresses from the Kfar Saba municipality page.
 *
 * The page contains several HTML tables. The kindergarten table has columns:
 *   מס' | שם גן | כתובת הגן
 *
 * We identify it by looking for a table whose header row contains "שם גן".
 */
async function main() {
  console.log('Fetching Kfar Saba municipality page...');
  const resp = await fetch(PAGE_URL);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const html = await resp.text();
  console.log('HTML length:', html.length);

  // ---- Extract all tables ----
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables = [];
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    tables.push(tableMatch[0]);
  }
  console.log('Tables found:', tables.length);

  // ---- Find the kindergarten table ----
  // The kindergarten table header contains "שם גן"
  let kinderTable = null;
  for (const t of tables) {
    if (t.includes('\u05e9\u05dd \u05d2\u05df')) {   // "שם גן"
      kinderTable = t;
      break;
    }
  }

  if (!kinderTable) {
    throw new Error('Could not find the kindergarten table (looked for header containing "שם גן")');
  }
  console.log('Found kindergarten table');

  // ---- Parse rows ----
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let rowMatch;
  while ((rowMatch = rowRegex.exec(kinderTable)) !== null) {
    rows.push(rowMatch[1]);
  }
  console.log('Rows in kindergarten table:', rows.length);

  // ---- Helper: extract cell text ----
  function extractCells(rowHtml) {
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let m;
    while ((m = cellRegex.exec(rowHtml)) !== null) {
      let text = m[1]
        .replace(/<[^>]+>/g, '')       // strip HTML tags
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(text);
    }
    return cells;
  }

  // ---- Build kindergarten entries ----
  const kindergartens = [];
  for (const rowHtml of rows) {
    const cells = extractCells(rowHtml);
    // Expect 3 columns: number, name, address
    if (cells.length < 3) continue;

    const num = cells[0].trim();
    // Skip header row (non-numeric first column)
    if (isNaN(parseInt(num))) continue;

    const name = cells[1].trim();
    let address = cells[2].trim();

    if (!name && !address) continue;

    // Clean parenthetical notes longer than 15 chars (keep short ones)
    let cleanAddr = address.replace(/\s*\(([^)]+)\)/g, function(match, inner) {
      return inner.length > 15 ? '' : match;
    }).trim();

    // Append "כפר סבא" if not already present
    if (cleanAddr && !cleanAddr.includes('\u05db\u05e4\u05e8 \u05e1\u05d1\u05d0')) {
      cleanAddr += ', \u05db\u05e4\u05e8 \u05e1\u05d1\u05d0';
    } else if (!cleanAddr) {
      cleanAddr = name + ', \u05db\u05e4\u05e8 \u05e1\u05d1\u05d0';
    }

    kindergartens.push({
      name: '\u05d2\u05df ' + name,   // prefix with "גן"
      address: cleanAddr
    });
  }

  console.log('Kindergarten entries extracted:', kindergartens.length);

  // ---- Deduplicate by address ----
  const seen = new Set();
  const unique = [];
  for (const k of kindergartens) {
    if (seen.has(k.address)) {
      console.log('  duplicate skipped:', k.name, '-', k.address);
      continue;
    }
    seen.add(k.address);
    unique.push(k);
  }

  if (unique.length < kindergartens.length) {
    console.log('After deduplication:', unique.length);
  }

  // ---- Print summary ----
  console.log('\nFirst 10 entries:');
  unique.slice(0, 10).forEach(function(k, i) {
    console.log('  ' + (i + 1) + '. ' + k.name + '  |  ' + k.address);
  });
  console.log('\nLast 5 entries:');
  unique.slice(-5).forEach(function(k, i) {
    console.log('  ' + (unique.length - 4 + i) + '. ' + k.name + '  |  ' + k.address);
  });

  // ---- Write output ----
  const outPath = path.join(__dirname, '..', 'input', 'kfar-saba-kindergartens.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf8');
  console.log('\nSaved ' + unique.length + ' entries to ' + outPath);
}

main().catch(function(e) { console.error(e); process.exit(1); });
