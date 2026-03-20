const fs = require('fs');
const file = fs.readFileSync('app/order-request-new.tsx', 'utf8');
const s = file.indexOf('// Material list cards');
console.log(file.substring(s, s + 600));
