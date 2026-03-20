const fs = require('fs');

const path = 'apps/mobile/app/(buyer)/orders.tsx';
let code = fs.readFileSync(path, 'utf8');

// Update Filter Chips
code = code.replace(/chip: \{[\s\S]*?chipCountTextActive: \{.*?\},/m, `chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { 
    backgroundColor: '#111827',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#ffffff' },
  chipCount: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipCountActive: { backgroundColor: '#374151' },
  chipCountText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  chipCountTextActive: { color: '#ffffff' },`);

// Update//ar// Uode = code.replace(/card: \{[\s\S]*?matDetail: .*?\},/m, `card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    // overflow: 'hidden', // remove if needed, but let's keep it
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  cardActive: { borderColor: '#111827' },
  activeStrip: { display: 'none' }, // Remove the side stripe in Uber-like design
  cardInner: { padding: 16 },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeTagText: { fontSize: 13, fontWeight: '600', color: '#475569' },

  orderTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 2, letterSpacing: -0.3 },
  orderRef: { fontSize: 13, color: '#9ca3af', marginBottom: 12, fontWeight: '500' },
  
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  driverName: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  callChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  metaText: { fontSize: 14, color: '#475569', flex: 1, fontWeight: '500' },

  matRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 0,
  },
  matDetail: { fontSize: 14, color: '#111827', flex: 1, fontWeight: '600' },`);

code = code.replace(/<View style=\{\[s\.typeTag, \{ backgroundColor: '#f1f5f9' \}\]\}>/g, '<View style={s.typeTag}>');

fs.writeFileSync(path, code);
