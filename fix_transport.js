const fs = require('fs');
const file = 'apps/web/src/app/dashboard/order/transport/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  \`const [vehicleType, setVehicleType] = useState<TransportVehicleType | ''>('TIPPER_LARGE');\`,
  \`const [vehicleType] = useState<TransportVehicleType | ''>('TIPPER_LARGE');\`
);

fs.writeFileSync(file, content);
