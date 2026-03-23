const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/,\s*Truck\s*,\s*Navigation\s*,\s*AlertTriangle\s*,\s*MapPin\s*\} from 'lucide-react';/, 'Truck, Navigation, AlertTriangle, MapPin } from "lucide-react";');

fs.writeFileSync(file, txt);
console.log('Fixed export comma');
