const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/Truck, Navigation, AlertTriangle, MapPin \} from "lucide-react";/, '} from "lucide-react";');

fs.writeFileSync(file, txt);
console.log('Fixed export duplicates');
