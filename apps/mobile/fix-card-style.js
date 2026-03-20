const fs = require('fs');
const file = './app/(buyer)/orders.tsx';
let content = fs.readFileSync(file, 'utf8');

const updatedStyles = content
  .replace(
    /card: {[^}]*elevation: 2,\s*},/s,
    `card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
  },`
  )
  .replace(
    /cardActive: { backgroundColor: '#eff6ff', shadowOpacity: 0.09, shadowRadius: 12, elevation: 3 },/s,
    `cardActive: { backgroundColor: '#f0fdfa', borderColor: '#bbf7d0' },`
  )
  .replace(
    /activeStrip: { width: 4, backgroundColor: '#2563eb' },/s,
    `activeStrip: { display: 'none' },`
  )
  .replace(
    /cardInner: { flex: 1, padding: 14 },/s,
    `cardInner: { flex: 1, padding: 16 },`
  );

if (content !== updatedStyles) {
  fs.writeFileSync(file, updatedStyles);
  console.log("Updated card styles");
} else {
  console.log("No changes made");
}
