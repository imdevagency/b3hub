const fs = require('fs');

// 1. Fix order/index.tsx - import Calendar
let order = fs.readFileSync('app/order/index.tsx', 'utf8');
if (order.includes('<Calendar') && !order.includes('react-native-calendars')) {
  order = order.replace(
    "import AsyncStorage from '@react-native-async-storage/async-storage';",
    "import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { Calendar, LocaleConfig } from 'react-native-calendars';"
  );
  fs.writeFileSync('app/order/index.tsx', order);
}

// 2. Fix transport/index.tsx - highlight property doesn't exist
let trans = fs.readFileSync('app/transport/index.tsx', 'utf8');
trans = trans.replace(/<DetailRow[\s\n]*label="Maršruts"[\s\n]*highlight/g, '<DetailRow label="Maršruts"');
// or more generally if it has a highlight prop anywhere on DetailRow:
trans = trans.replace(/<DetailRow([^>]+)highlight([\s>])/g, '<DetailRow$1$2');
// Wait, regex might be tricky, let's just search and replace the exact string from line 669.
fs.writeFileSync('app/transport/index.tsx', trans);
console.log('Fixed typescript complaints!');
