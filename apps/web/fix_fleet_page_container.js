const fs = require('fs');

let content = fs.readFileSync('src/app/dashboard/fleet/page.tsx', 'utf8');

// replace PageHeader import with PageContainer
content = content.replace(
  "import { PageHeader } from '@/components/ui/page-header';",
  "import { PageContainer } from '@/components/ui/page-container';"
);

// replace <div className="space-y-6"> and <PageHeader ... /> with <PageContainer ...>
const headerRegex = /<div className="space-y-6">\s*\{\/\* Header \*\/\}\s*<PageHeader([^>]+)>/s;
const match = content.match(headerRegex);

if (match) {
  content = content.replace(headerRegex, `<PageContainer${match[1]}>`);
  
  // Now replace the last closing </div> with </PageContainer>
  let lastDivIndex = content.lastIndexOf('</div>');
  if (lastDivIndex !== -1) {
    content = content.substring(0, lastDivIndex) + '</PageContainer>' + content.substring(lastDivIndex + 6);
  }
}

fs.writeFileSync('src/app/dashboard/fleet/page.tsx', content);
