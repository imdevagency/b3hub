const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'apps/mobile/app/(buyer)/_layout.tsx');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "const isHome = pathname === '/(buyer)/home' || pathname === '/home';",
  `const isHome = pathname === '/(buyer)/home' || pathname === '/home';
  const isDetailScreen = pathname.includes('/rfq/') || pathname.includes('/project/') || pathname.includes('/transport-job/') || pathname.includes('/framework-contract/') || pathname.includes('/skip-order/');
  const hideTopBar = isHome || isDetailScreen;`
);

code = code.replace(
  "{!isHome && (",
  "{!hideTopBar && ("
);

code = code.replace(
  "paddingTop: isHome ? 0 : insets.top",
  "paddingTop: hideTopBar ? 0 : insets.top"
);

fs.writeFileSync(file, code, 'utf8');
console.log('done!');