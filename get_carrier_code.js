const fs = require('fs');
const file = fs.readFileSync('apps/web/src/app/dashboard/orders/page.tsx', 'utf8');
const start = file.indexOf('function ActiveJobTab');
const end = file.indexOf('function CarrierHistoryView');
if (start > -1 && end > -1) {
  console.log(`Found ActiveJobTab from char ${start} to ${end}. Length: ${end - start}`);
}
