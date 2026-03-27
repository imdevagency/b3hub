const fs = require('fs');
fs.writeFileSync('apps/mobile/app/(driver)/active.tsx', 
  fs.readFileSync('apps/mobile/app/(driver)/active.tsx', 'utf8') + '\n\n'
);
