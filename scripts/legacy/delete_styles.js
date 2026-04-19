const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'app/disposal/index.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const regex = /\s*\/\/\s*── Truck type selector[\s\S]*?\}\);/m;
const match = content.match(regex);

if (match) {
  content = content.replace(regex, '\n});');
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log("Deleted dead styles!");
} else {
  console.log("Not found.");
}
