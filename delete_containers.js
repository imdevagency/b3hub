const fs = require('fs');
const path = require('path');
const filePath = path.join(process.cwd(), 'apps/mobile/app/(buyer)/containers.tsx');
try {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('File deleted successfully');
  } else {
    console.log('File not found');
  }
} catch (err) {
  console.error('Error deleting file:', err);
}
