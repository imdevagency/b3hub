const fs = require('fs');
const content = fs.readFileSync('components/wizard/InlineAddressStep.tsx', 'utf8');

const updated = content.replace(
  /sugText: \{ flex: 1, fontSize: 15, fontWeight: '500', color: '#111827', lineHeight: 22 \},[\s\S]*?confirmedChip: \{/g,
  `sugText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#111827', lineHeight: 22 },\n\n  confirmedChip: {`
);

fs.writeFileSync('components/wizard/InlineAddressStep.tsx', updated);
