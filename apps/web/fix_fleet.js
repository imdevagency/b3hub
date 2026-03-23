const fs = require('fs');
const file = 'src/app/dashboard/fleet/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// There is an extra </div> at line 312
code = code.replace(/<s\.icon className=\{\`h-4 w-4 \$\{s\.color\}\`\} \/>\n            <\/div>\n            <p className=\{\`text-2xl font-bold tabular-nums \$\{s\.color\}\`\}>\{s\.value\}<\/p>\n            <\/div>\n          <\/div>/g, '<s.icon className={`h-4 w-4 ${s.color}`} />\n            </div>\n            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>\n          </div>');

fs.writeFileSync(file, code);
