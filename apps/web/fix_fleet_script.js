const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/fleet/page.tsx', 'utf8');

// Replace the container start that wasn't replaced earlier
const oldStart = `<div className="space-y-6">
      {/* Header */}
      <PageHeader`;

const index = code.indexOf(oldStart);
if (index !== -1) {
  const closeIndex = code.indexOf('/>', index);
  if (closeIndex !== -1) {
    const headerProps = code.substring(index + oldStart.length, closeIndex);
    const before = code.substring(0, index);
    const after = code.substring(closeIndex + 2);
    code = before + '<PageContainer' + headerProps + '>' + after;
  }
}

// Fix the \n literal
code = code.replace(/\\n\s*<div/g, '\n            <div');

// Fix the double className on Button
code = code.replace(/className="rounded-xl border-border\/60 hover:bg-muted\/50" className="mt-3"/g, 'className="rounded-xl border-border/60 hover:bg-muted/50 mt-3"');

// Add import for PageContainer
if (!code.includes("import { PageContainer }")) {
  code = code.replace("import { PageHeader } from '@/components/ui/page-header';", "import { PageHeader } from '@/components/ui/page-header';\nimport { PageContainer } from '@/components/ui/page-container';");
}

fs.writeFileSync('src/app/dashboard/fleet/page.tsx', code);
console.log('Successfully completed regex replacements in fleet/page.tsx');
