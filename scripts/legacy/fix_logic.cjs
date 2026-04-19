const fs = require('fs');

let content = fs.readFileSync('apps/mobile/app/(driver)/active.tsx', 'utf8');

// 1. replace imports
content = content.replace(/import \{ .*Text.* \} from 'react-native';/, match => match.replace('Text, ', '').replace('Text', ''));
content = content.replace(/import \{ JobRouteMap \} from '@\/components\/map\/JobRouteMap';/,
  "import { JobRouteMap } from '@/components/map/JobRouteMap';\nimport { ScreenHeader } from '@/components/ui/ScreenHeader';\nimport { InfoSection } from '@/components/ui/InfoSection';\nimport { DetailRow } from '@/components/ui/DetailRow';\nimport { Button } from '@/components/ui/button';\nimport { Text as UIText } from '@/components/ui/text';");

content = content.replace("import {\n  MapPin,\n  Phone,\n  CheckCircle2,\n  Navigation2,\n  Route,\n  Truck,\n  Camera,\n  CheckCircle,\n  MessageCircle,\n  AlertTriangle,\n  Clock,\n  ArrowLeft,\n  HelpCircle,\n  MapPin,\n  User,\n} from 'lucide-react-native';",
  "import { MapPin, Phone, MessageSquare, Truck, Package, Clock, CheckCircle2, RotateCcw, AlertCircle, Camera, Check, FileText } from 'lucide-react-native';"
);

// 2. logic bugs: gps
content = content.replace(
  "useEffect(() => {\n    if (!job) return;\n\n    // Foreground tracking\n    Location.requestForegroundPermissionsAsync().then(({ status }) => {\n      if (status !== 'granted') return;\n      Location.watchPositionAsync(\n        { accuracy: Location.Accuracy.Balanced, distanceInterval: 30 },\n        (loc) => setGpsFix(loc.coords)\n      ).then((sub) => (gpsSub.current = sub));\n    });\n\n    // Background tracking sync",
  "useEffect(() => {\n    // Foreground tracking\n    Location.requestForegroundPermissionsAsync().then(({ status }) => {\n      if (status !== 'granted') return;\n      Location.watchPositionAsync(\n        { accuracy: Location.Accuracy.Balanced, distanceInterval: 30 },\n        (loc) => setGpsFix(loc.coords)\n      ).then((sub) => (gpsSub.current = sub));\n    });\n  }, []);\n\n  // Background tracking sync\n  useEffect(() => {\n    if (!job?.id) return;\n"
);

content = content.replace(
  "if (job.status === 'EN_ROUTE_PICKUP' || job.status === 'EN_ROUTE_DELIVERY') {\n      startLocationTracking(job.id);\n    } else {\n      stopLocationTracking();\n    }",
  "if (job.status === 'EN_ROUTE_PICKUP' || job.status === 'EN_ROUTE_DELIVERY' || job.status === 'AT_PICKUP') {\n      startLocationTracking(job.id);\n    } else {\n      stopLocationTracking();\n    }"
);

// 3. Logic bugs: exception modal
content = content.replace(
  "const [exceptionModalVisible, setExceptionModalVisible] = React.useState(false);",
  "const [exceptionModalVisible, setExceptionModalVisible] = React.useState(false);\n  const [exceptionType, setExceptionType] = React.useState('VEHICLE_BREAKDOWN');"
);

// Replace topOverlay
content = content.replace(/<View style=\{styles\.topOverlay\}>[\s\S]*?<\/View>/, `<ScreenHeader title="Aktīvs brauciens" onBack={() => router.push('/(driver)/jobs')} />`);

fs.writeFileSync('apps/mobile/app/(driver)/active.tsx', content);
