const fs = require('fs');
const file = 'src/app/dashboard/fleet/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/          <\/div>\n        \}\}\)\n    <\/div>/g, '          </div>\n        )}\n    </div>');

fs.writeFileSync(file, code);
