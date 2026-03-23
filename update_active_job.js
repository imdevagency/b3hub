const fs = require('fs');

const file = 'apps/web/src/app/dashboard/orders/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update StaticMapEmbed to be taller and simpler
content = content.replace(
  `style={{ height: 280 }}`,
  `style={{ height: '100%', minHeight: 400 }}`
);

content = content.replace(
  `className="w-full rounded-2xl overflow-hidden border shadow-sm"`,
  `className="w-full h-full object-cover"`
);

// We need to rewrite the main render of ActiveJobTab starting from `if (!job) {`
const renderStartMarker = "if (!job) {";
const renderStartIdx = content.indexOf(renderStartMarker, content.indexOf('function ActiveJobTab'));
const renderEndIdx = content.indexOf(`function CarrierHistoryView`, renderStartIdx);

if (renderStartIdx > -1 && renderEndIdx > -1) {
  const originalRender = content.substring(renderStartIdx, renderEndIdx);
  
  // We'll replace this part entirely
}
