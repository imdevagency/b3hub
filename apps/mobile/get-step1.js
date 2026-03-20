const fs = require('fs');
const file = fs.readFileSync('components/wizard/InlineAddressStep.tsx', 'utf8');
const s = file.indexOf('return (');
const e = file.indexOf('// \u2500\u2500 Styles', s);
console.log(file.substring(s, e));
