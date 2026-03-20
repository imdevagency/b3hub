const fs = require('fs');
const file = 'components/wizard/InlineAddressStep.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/\/\/ context card.*?\n/g, '');
txt = txt.replace(/  contextCard: \{[\s\S]*?\},/g, '');
txt = txt.replace(/  contextSection: \{[\s\S]*?\},/g, '');
txt = txt.replace(/  contextIconWrap: \{[\s\S]*?\},/g, '');
txt = txt.replace(/  contextTextWrap: \{[\s\S]*?\},/g, '');
txt = txt.replace(/  contextHint: \{[\s\S]*?\},/g, '');
txt = txt.replace(/  contextAddressText: \{[\s\S]*?\},/g, '');
txt = txt.replace(/  contextAction: \{[\s\S]*?\},/g, '');
txt = txt.replace(/  contextActionText: \{[\s\S]*?\},/g, '');

fs.writeFileSync(file, txt);
