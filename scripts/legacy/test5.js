const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

console.log("Has import PageHeader?", txt.includes("import { PageHeader } from '@/components/ui/page-header';"));
console.log("Has Mui imports?", txt.includes("import { EmptyState }"));

const sIdx = txt.indexOf('{job.slaStatus &&');
console.log("Has slaStatus?", sIdx !== -1, "at", sIdx);

