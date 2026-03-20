const fs = require('fs');

let content = fs.readFileSync('app/order-request-new.tsx', 'utf8');

// Modifying renderMaterial
content = content.replace(
  /<Text style=\{s\.stepSub\}>Grants, smiltis, betons un citi būvmateriāli<\/Text>\s*<ScrollView/g,
  `<ScrollView`
);

// We replace `\u00d7` with `x` in Review step
content = content.replace(
  /\{quantity\} \{UNIT_SHORT\[selectedMaterial\?\.unit \?\? 'TONNE'\]\} \\u00d7 \{\'\\u20AC'\}/g,
  `{quantity} {UNIT_SHORT[selectedMaterial?.unit ?? 'TONNE']} x {'\\u20AC'}`
);

fs.writeFileSync('app/order-request-new.tsx', content);
