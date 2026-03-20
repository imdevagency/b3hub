const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'apps/mobile/app/(buyer)/home.tsx');

let code = fs.readFileSync(file, 'utf8');

const sIdx = code.indexOf('const s = StyleSheet.create({');
if (sIdx === -1) {
  console.log('could not find sStart');
  process.exit(1);
}

const newStyles = `const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  greetLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500', lineHeight: 17 },
  greetName: { fontSize: 19, fontWeight: '800', color: '#111827', letterSpacing: -0.4 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#f9fafb',
  },

  scroll: { paddingHorizontal: 16, gap: 16, paddingTop: 4 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -4,
  },
  seeAll: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // Active order
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, opacity: 0.35 },
  activeTag: { fontSize: 12, color: '#9ca3af', fontWeight: '500', marginBottom: 4 },
  activeNum: { fontSize: 18, fontWeight: '800', color: '#ffffff', lineHeight: 22, letterSpacing: -0.4 },
  activeSub: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  activeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Services 2x2 grid
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#f3f4f6', 
    borderRadius: 20,
    padding: 16,
    gap: 12, 
    borderWidth: 0, 
  },
  serviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff', 
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  serviceLabel: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 20 },
  serviceSub: { fontSize: 13, color: '#6b7280', lineHeight: 18 },

  // Recent orders
  recentList: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb', 
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  recentBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  recentIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6', 
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentNum: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  recentSub: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginTop: 2 },
  recentStatus: { fontSize: 12, color: '#475569', fontWeight: '500' },

  // All orders button
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderWidth: 0,
  },
  allBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  
  // Empty state
  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30, // Make it fully rounded
    backgroundColor: '#f3f4f6', // Remove borders, change background
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptySub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  emptyCta: {
    marginTop: 6,
    backgroundColor: '#111827',
    borderRadius: 16, // Smoother corners for CTA
    paddingHorizontal: 28,
    paddingVertical: 16, // Taller touch target
  },
  emptyCtaText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});`;

code = code.substring(0, sIdx) + newStyles;
fs.writeFileSync(file, code, 'utf8');
console.log('done!');
