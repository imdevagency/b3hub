const fs = require('fs');
const file = fs.readFileSync('apps/mobile/app/order-request-new.tsx', 'utf8');
const s = file.indexOf('const renderConfigure = () => {');
const e = file.indexOf('const renderReview = () => {', s);
console.log(file.substring(s, e));
