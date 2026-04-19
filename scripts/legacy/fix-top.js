const fs = require('fs');

let text = fs.readFileSync('apps/mobile/app/(buyer)/transport-job/[id].tsx', 'utf8');

text = text.replace("import { ScreenContainer }\nimport { ScreenHeader } from '@/components/ui/ScreenHeader'; from '@/components/ui/ScreenContainer';", "import { ScreenContainer } from '@/components/ui/ScreenContainer';\nimport { ScreenHeader } from '@/components/ui/ScreenHeader';");

fs.writeFileSync('apps/mobile/app/(buyer)/transport-job/[id].tsx', text);
