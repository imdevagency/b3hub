const fs = require('fs');
const file = fs.readFileSync('app/order-request-new.tsx', 'utf8');
const s = file.indexOf('const renderMaterial = () => {');
if (s === -1) {
  const altS = file.indexOf('const renderMaterial = () => (');
  const e = file.indexOf('const renderConfigure = () => {', altS);
  console.log(file.substring(altS, e));
} else {
  const e = file.indexOf('const renderConfigure = () => {', s);
  console.log(file.substring(s, e));
}
