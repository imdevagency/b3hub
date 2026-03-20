const fs = require('fs');
const file = fs.readFileSync('app/order-request-new.tsx', 'utf8');
const s = file.indexOf('Izvēlētais materiāls');
console.log(file.substring(s - 400, s + 300));
