const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/fleet/page.tsx', 'utf8');

code = code.replace(
  '            </table>\n\n            {/* Table',
  '            </table>\n            </div>\n\n            {/* Table'
);

fs.writeFileSync('src/app/dashboard/fleet/page.tsx', code);
console.log('Fixed missing div');
