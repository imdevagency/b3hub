const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/fleet/page.tsx', 'utf8');

// 1. Restore the <List /> self-closing tag
code = code.replace('<List className="h-3.5 w-3.5" >', '<List className="h-3.5 w-3.5" />');

// 2. Change the closing of PageContainer from `/>` to `>` where it ends the action prop
// Look for this specific sequence:
/*
          }
        />
*/
code = code.replace(/(\}\s*)\/>(\s*\{\/\* Stats row)/g, '$1>$2');

fs.writeFileSync('src/app/dashboard/fleet/page.tsx', code);
console.log('Fixed syntax!');
