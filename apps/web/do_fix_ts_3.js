const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

if (!txt.includes("import { EmptyState }")) {
  txt = txt.replace(
    "import { PageSpinner } from '@/components/ui/page-spinner';",
    "import { PageSpinner } from '@/components/ui/page-spinner';\nimport { EmptyState } from '@/components/ui/empty-state';"
  );
}

// Ensure Truck and Navigation are imported
if (!txt.includes("import { Truck")) {
    // Actually, look for `lucide-react`
    const lucideIdx = txt.indexOf('from \'lucide-react\';');
    if (lucideIdx !== -1) {
       // if there is a lucide import, replace the curly brace
       // actually let's just add it
       txt = txt.replace('from \'lucide-react\';', 'from \'lucide-react\';\nimport { Truck, Navigation, AlertCircle } from \'lucide-react\';');
    } else {
        txt = txt.replace(
            "import { PageSpinner } from '@/components/ui/page-spinner';",
            "import { PageSpinner } from '@/components/ui/page-spinner';\nimport { Truck, Navigation, AlertCircle } from 'lucide-react';"
        );
    }
}

// remove {job.slaStatus !== ...} block
const slaMatch = /\{job\.slaStatus !== 'ON_TIME' && job\.status !== 'DELIVERED' && \([\s\S]*?\}\)/;
if (slaMatch.test(txt)) {
    txt = txt.replace(slaMatch, '');
}

fs.writeFileSync(file, txt);
console.log("Imports fixed!");
