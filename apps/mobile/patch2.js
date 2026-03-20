const fs = require('fs');
let file = fs.readFileSync('app/order-request-new.tsx', 'utf8');

// Replace review card styles to match configure Card styles identically. 
file = file.replace(
  /reviewCard: \{\s*backgroundColor: '#fff',\s*borderRadius: 14,\s*padding: 16,\s*borderWidth: 1,\s*borderColor: '#e5e7eb',\s*\}/,
  `reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  }`
);

file = file.replace(
  /<Text style=\{s\.stepSub\}>Pārbaudiet visu pirms apstiprināšanas<\/Text>\n\s*/g,
  ''
);

fs.writeFileSync('app/order-request-new.tsx', file);
