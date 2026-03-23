const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Fix duplicates more cleanly
const lines = txt.split('\n');
const newLines = [];
let hasEmptyState = false;
let lucideLineIndex = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('import { EmptyState }')) {
    if (hasEmptyState) continue; // skip duplicate EmptyState
    hasEmptyState = true;
  }
  
  if (
    line === "import { Truck } from 'lucide-react';" ||
    line === "import { Navigation } from 'lucide-react';" || 
    line === "import { AlertTriangle } from 'lucide-react';" ||
    line === "import { MapPin } from 'lucide-react';" ||
    line === "import { Truck, Navigation, AlertTriangle } from 'lucide-react';" ||
    line === "import { MapPin, Truck, Navigation, AlertTriangle } from 'lucide-react';"
  ) {
    continue; // Remove standalone duplicates and my prev injected ones
  }
  
  if (line.includes('from \'lucide-react\';')) {
    lucideLineIndex = newLines.length; // track index to append missing icons
  }
  
  newLines.push(line);
}

if (lucideLineIndex !== -1) {
    let lLine = newLines[lucideLineIndex];
    const missing = ['Truck', 'Navigation', 'AlertTriangle', 'MapPin'];
    for(let m of missing) {
        if (!lLine.includes(m)) {
            // insert right before closing brace
            lLine = lLine.replace('}', `, ${m} }`);
        }
    }
    newLines[lucideLineIndex] = lLine;
}

txt = newLines.join('\n');

// Fix JOB_STATUS.label
txt = txt.replace(
  '{JOB_STATUS[(job.status as any)] || job.status}',
  '{(JOB_STATUS[(job.status as any)] || {}).label || job.status}'
);

fs.writeFileSync(file, txt);
console.log('Fixed V3 using create_file');
