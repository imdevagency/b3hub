const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src/app/dashboard/orders/page.tsx');
let txt = fs.readFileSync(src, 'utf8');

const sIdx = txt.indexOf('return (');
const sIdx2 = txt.indexOf('{/* Delivery Success Modal */}', sIdx);
const eIdx = txt.indexOf('function CarrierHistoryView({', sIdx2);

console.log({sIdx, sIdx2, eIdx});

const suffix = txt.substring(eIdx);
const eIdxReal = txt.lastIndexOf('}', eIdx);
console.log({eIdxReal, "e2": eIdxReal - eIdx});
