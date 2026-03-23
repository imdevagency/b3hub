const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/fleet/page.tsx', 'utf8');

// Replace `<div className="space-y-6">\n        {/* Header */}\n        <PageHeader`
// With `<PageContainer`
let newContent = content.replace(
  /<div className="space-y-6">\s*\{\/\* Header \*\/\}\s*<PageHeader/g,
  '<PageContainer'
);

// We need to find the `/>` that closes the PageHeader and remove it, since it's now PageContainer which ends at `</PageContainer>`.
// Wait, PageContainer wraps children, so when we open `<PageContainer title="..." ... >` we should close it with `>` instead of `/>`.
// Let's find the `/>` corresponding to PageHeader.
