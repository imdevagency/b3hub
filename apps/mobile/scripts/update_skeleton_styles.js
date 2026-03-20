const fs = require('fs');
const filePath = 'components/ui/Skeleton.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /backgroundColor: '#fff',\s*borderRadius: 12,\s*padding: 14,\s*borderWidth: 1,\s*borderColor: '#f3f4f6',/m,
  "backgroundColor: '#f3f4f6',\n    borderRadius: 20,\n    padding: 16,"
);

fs.writeFileSync(filePath, content);
console.log('skeleton styles updated');
