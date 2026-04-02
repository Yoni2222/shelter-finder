const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Add hasHebrew helper and change signature
html = html.replace(
  'function localizeName(name) {',
  '// Check if text contains Hebrew characters
' +
  'function hasHebrew(str) { return /[֐-׿]/.test(str); }

' +
  'function localizeName(name, shelter) {'
);

// 2. Add migonit prefix
html = html.replace(
  "  if (name.startsWith('מרחב מוגן '))      return 'Protected Space '      + name.slice('מרחב מוגן '.length);",
  "  if (name.startsWith('מרחב מוגן '))      return 'Protected Space '      + name.slice('מרחב מוגן '.length);
" +
  "  if (name.startsWith('מיגונית '))        return 'Safe Room '            + name.slice('מיגונית '.length);"
);

console.log('Step 1-2 done');
fs.writeFileSync('public/index.html', html, 'utf8');
