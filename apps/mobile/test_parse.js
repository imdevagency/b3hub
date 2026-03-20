const fs = require('fs');
const babel = require('@babel/parser');

const code = fs.readFileSync('app/(driver)/active.tsx', 'utf8');

try {
  babel.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });
  console.log("Parse success!");
} catch (e) {
  console.error("Parse error:", e.message, "at line", e.loc?.line, "col", e.loc?.column);
}
