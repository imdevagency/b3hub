const fs = require('fs');
console.log(fs.readFileSync('app/order-request-new.tsx', 'utf-8').includes('const stepAmt = unit === \'M3\' ? 1 : 5;'));
