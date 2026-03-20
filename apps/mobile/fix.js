const fs = require('fs');
let code = fs.readFileSync('/Users/dags/Desktop/b3hub/run_update.js', 'utf8');
code = code.replace(/\\\/\\\/ ── Category Pill ──\[\\s\\S\]\*\?\\\/\\\/ ── Product Card ──/, '\\/\\/ ── Category Pill ──[\\s\\S]*?\\/\\/ ── Product Card ─*\\n');
fs.writeFileSync('/Users/dags/Desktop/b3hub/run_update.js', code);
