const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Ensure EmptyState is imported
if (!txt.includes("import { EmptyState }")) {
  txt = txt.replace(
    "import { PageHeader } from '@/components/ui/page-header';",
    "import { PageHeader } from '@/components/ui/page-header';\nimport { EmptyState } from '@/components/ui/empty-state';"
  );
}

// Ensure Truck is imported from lucide-react if not already
if (!txt.includes("Truck")) {
  txt = txt.replace(
    "import {",
    "import { Truck,"
  );
}

// Remove slaStatus logic
const sIdx = txt.indexOf('{job.slaStatus &&');
if (sIdx !== -1) {
  const start = txt.lastIndexOf('{job.slaStatus &&', sIdx);
  if (start !== -1) {
    let count = 0;
    let end = start;
    for (let i = start; i < txt.length; i++) {
      if (txt[i] === '{') count++;
      if (txt[i] === '}') {
        count--;
        if (count === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== start) {
      txt = txt.substring(0, start) + txt.substring(end + 1);
    }
  }
}

fs.writeFileSync(file, txt);
console.log('Fixed TS imports and SLA status');