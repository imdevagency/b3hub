const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const sIdx = txt.indexOf('return (', txt.indexOf('function ActiveJobTab'));
const realSIdx = txt.indexOf('{/* Delivery Success Modal */}', sIdx);

console.log(txt.substring(sIdx, realSIdx));
