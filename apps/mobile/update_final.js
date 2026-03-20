const fs = require('fs');
const file = 'components/wizard/InlineAddressStep.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /  confirmedText: \{[\s\S]*?\},/,
  "  confirmedText: { flex: 1, fontSize: 15, color: '#111827', lineHeight: 22, fontWeight: '600' },"
);

fs.writeFileSync(file, content);
