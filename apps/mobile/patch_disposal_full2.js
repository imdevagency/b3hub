const fs = require('fs');

let content = fs.readFileSync('app/disposal/index.tsx', 'utf-8');

// 1. `wasteRow` styles
content = content.replace(
`  wasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
    padding: 16,
  },
  wasteRowSel: {
    borderColor: '#000',
    backgroundColor: '#fafafa',
  },`,
`  wasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderWidth: 0,
    padding: 16,
  },
  wasteRowSel: {
    backgroundColor: '#111827',
  },`
);

// waste item JSX rendering updates
// Instead of replacing raw text blocks that might mismatch, I'll use regex.
// WasteIcon color:
content = content.replace(
  /color=\{isSel \? '#111827' : '#6b7280'\}/g,
  "color={isSel ? '#ffffff' : '#6b7280'}"
);
// wasteLabel color
content = content.replace(
  /<Text style=\{\[s\.wasteLabel, isSel && \{ color: '#000' \}\]\}>\{opt\.label\}<\/Text>/g,
  "<Text style={[s.wasteLabel, isSel && { color: '#ffffff' }]}>{opt.label}</Text>"
);
// wasteDesc color
content = content.replace(
  /<Text style=\{\[s\.wasteDesc, isSel && \{ color: '#4b5563' \}\]\}>\{opt\.desc\}<\/Text>/g,
  "<Text style={[s.wasteDesc, isSel && { color: '#9ca3af' }]}>{opt.desc}</Text>"
);

// Checkbox styling update in the stylesheet
content = content.replace(
`  checkboxOuter: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOuterSel: {
    backgroundColor: '#000',
    borderColor: '#000',
  },`,
`  checkboxOuter: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxOuterSel: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },`
);
// And the `Check` icon color should be black when white background!
content = content.replace(
  /<Check size=\{14\} color="#fff" strokeWidth=\{3\} \/>/g,
  '<Check size={14} color="#111827" strokeWidth={3} />'
);

// 2. `volRow` styles
content = content.replace(
`  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f3f4f6',
  },
  volRowSel: {
    borderColor: '#111827',
    backgroundColor: '#f8fafc',
  },`,
`  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0,
  },
  volRowSel: {
    backgroundColor: '#111827',
  },`
);
// Make the vol row active items white
content = content.replace(
`  volRowLabelSel: {
    color: '#111827',
  },`,
`  volRowLabelSel: {
    color: '#ffffff',
  },`
);
content = content.replace(
`  volRowSubSel: {
    color: '#4b5563',
  },`,
`  volRowSubSel: {
    color: '#9ca3af',
  },`
);
content = content.replace(
`  volRowPriceSel: {
    color: '#111827',
  },`,
`  volRowPriceSel: {
    color: '#ffffff',
  },`
);
// Ensure the icon badge for volRow isn't too light on top of light background if it blends, but #f3f4f6 on #f3f4f6 is invisible. Better make icon background white.
content = content.replace(
`  volRowIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },`,
`  volRowIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },`
);

// 3. `addressCard` styles in Step 2.
content = content.replace(
`  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },`,
`  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 0,
    borderRadius: 12,
    padding: 16,
  },`
);

// Also remove borderWidth from inputs inside `InlineAddressStep` if it's there. 
// But `InlineAddressStep` is a shared component from `@/components/wizard/InlineAddressStep`.
// Wait, is there any `borderWidth: 1.5` left in `disposal/index.tsx`?

// 4. `s.input` for custom weight text input in Step 3
content = content.replace(
`  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },`,
`  input: {
    backgroundColor: '#f3f4f6',
    borderWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },`
);

// 5. checkboxOuter was handled. What about `saveAddrCheck` in step 4?
// Let's drop it to `borderWidth: 1.2` or keep `1.5` as a checkbox requires clear borders against white.
content = content.replace(
`  saveAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },`,
`  saveAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 0,
    marginBottom: 12,
  },`
);


fs.writeFileSync('app/disposal/index.tsx', content);
console.log('Fully flattened UI in disposal!');
