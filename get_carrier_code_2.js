const fs = require('fs');
const file = fs.readFileSync('apps/web/src/app/dashboard/orders/page.tsx', 'utf8');
const start = file.indexOf('function ActiveJobTab');
let end = file.indexOf('function CarrierHistoryView');
console.log(file.substring(start, end).split('\n').slice(-50).join('\n'));
