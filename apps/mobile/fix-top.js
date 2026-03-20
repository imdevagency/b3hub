const fs = require('fs');
const file = 'components/wizard/InlineAddressStep.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(
  /\{\/\* Optional banner[\s\S]*?\{\/\* Map fills all available space \*\//m,
  `{/* Map fills all available space */`
);

fs.writeFileSync(file, txt);
