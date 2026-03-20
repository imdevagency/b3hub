const file = require('fs').readFileSync('app/order-request-new.tsx', 'utf8');
const s = file.indexOf('const renderReview = () => {');
const e = file.indexOf('return (\n    <WizardLayout', s);
console.log(file.substring(s, e));
