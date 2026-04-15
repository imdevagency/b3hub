const fs = require('fs');

let order = fs.readFileSync('app/order/index.tsx', 'utf8');
if (!order.includes('import { Calendar, LocaleConfig } from \'react-native-calendars\';')) {
  order = order.replace(
    /import \{[^\}]+\} from 'react-native';/,
    `$&
import { Calendar, LocaleConfig } from 'react-native-calendars';`
  );
  fs.writeFileSync('app/order/index.tsx', order);
}
console.log('Fixed order index.tsx import');
