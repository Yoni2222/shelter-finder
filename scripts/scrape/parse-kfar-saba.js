'use strict';
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

async function main() {
  // Fetch the page
  console.log('Fetching...');
  const resp = await fetch('https://kfar-saba.muni.il/%D7%A8%D7%A9%D7%99%D7%9E%D7%AA-%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D-%D7%A2%D7%99%D7%A8%D7%95%D7%A0%D7%99%D7%99%D7%9D-%D7%91%D7%9B%D7%A4%D7%A8-%D7%A1%D7%91%D7%90/');
  const html = await resp.text();
  console.log('HTML length:', html.length);

  // Extract all table rows
  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  console.log('Total table rows:', trs.length);

  // Parse each row into cells
  const allRows = [];
  for (const tr of trs) {
    const cells = [];
    const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let m;
    while (m = re.exec(tr)) {
      let text = m[1].replace(/<[^>]+>/g, '');
      text = text.replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(text);
    }
    if (cells.length >= 3) allRows.push(cells);
  }

  console.log('Rows with 3+ columns:', allRows.length);

  // Invalid address patterns to skip
  const SKIP_ADDRESSES = ['\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9', '\u05e7\u05d9\u05d9\u05dd', '\u05de\u05db\u05e1\u05d4'];
  // "לא רלוונטי", "קיים", "מכסה"

  // Build shelters array - skip headers (non-numeric first column)
  const rawShelters = [];
  let count = 0;
  for (const row of allRows) {
    const firstCell = row[0].trim();
    if (isNaN(parseInt(firstCell))) continue;

    const name = row[2] || '';
    let address = (row[3] || '').trim();

    if (!address && !name) continue;

    // Skip entries with invalid/placeholder addresses
    if (SKIP_ADDRESSES.some(s => address === s || name === s)) continue;
    if (address === '\u05de\u05db\u05e1\u05d4' || name === '\u05de\u05db\u05e1\u05d4') continue;

    // Clean up: remove parenthetical notes longer than 8 chars (keep short ones like שכ' 80)
    function cleanParens(s) {
      return s.replace(/\s*\(([^)]+)\)/g, (match, inner) => {
        return inner.length > 8 ? '' : match;
      }).trim();
    }
    let cleanName = cleanParens(name);
    let cleanAddr = cleanParens(address);

    // Append כפר סבא if not already present
    const addrWithCity = cleanAddr
      ? (cleanAddr.includes('\u05db\u05e4\u05e8 \u05e1\u05d1\u05d0') ? cleanAddr : cleanAddr + ' \u05db\u05e4\u05e8 \u05e1\u05d1\u05d0')
      : (cleanName + ' \u05db\u05e4\u05e8 \u05e1\u05d1\u05d0');

    count++;
    rawShelters.push({
      name: cleanName || ('\u05de\u05e7\u05dc\u05d8 ' + count),
      address: addrWithCity
    });
  }

  console.log('Raw entries (after filtering invalid):', rawShelters.length);

  // Deduplicate by address
  const seen = new Set();
  const shelters = [];
  for (const s of rawShelters) {
    const key = s.address;
    if (seen.has(key)) continue;
    seen.add(key);
    shelters.push(s);
  }

  console.log('After deduplication:', shelters.length);

  // Print samples
  console.log('\nFirst 10:');
  shelters.slice(0, 10).forEach((s, i) => console.log((i + 1) + '. ' + s.name + ' - ' + s.address));
  console.log('\nLast 5:');
  shelters.slice(-5).forEach((s, i) => console.log((shelters.length - 4 + i) + '. ' + s.name + ' - ' + s.address));

  // Write output
  const outPath = path.join(__dirname, '..', 'input', 'kfar-saba-addresses.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log('\nSaved ' + shelters.length + ' entries to ' + outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
