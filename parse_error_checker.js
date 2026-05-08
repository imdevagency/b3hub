const fs = require('fs');
const content = fs.readFileSync('apps/web/src/app/dashboard/(platform)/orders/[id]/page.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 1000; i < 1015; i++) {
    if(lines[i] !== undefined) {
      console.log(`${i+1}: ${lines[i]}`);
    }
}
