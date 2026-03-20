const fs = require('fs');
const filePath = 'app/(seller)/quotes.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const newStyles = `const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  refreshIconBtn: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  countChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
  },
  refreshBtnText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 15,
  },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardResponded: {
    backgroundColor: '#e0f2fe',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  categoryBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 24,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  cardMetaText: {
    fontSize: 14,
    color: '#4b5563',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#9ca3af',
    flex: 1,
  },
  responseCountText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },

  // ── Expanded ──────────────────────────────────────────────────
  expandedBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    minWidth: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flexShrink: 1,
  },
  requestNumber: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    marginBottom: 12,
  },
  alreadyRespondedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  alreadyRespondedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
  },
  respondBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
  },
  respondBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },

  // ── Modal ─────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    overflow: 'hidden',
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  priceUnit: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#e5e7eb',
  },
  priceUnitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  stepBtn: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepValue: {
    paddingHorizontal: 24,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    minWidth: 48,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#111827',
    height: 100,
    textAlignVertical: 'top',
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  totalPreviewLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  totalPreviewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  successMsg: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
});`;

const startIndex = content.indexOf('const styles = StyleSheet.create({');
if (startIndex === -1) {
  console.log('styles not found');
  process.exit(1);
}

const newContent = content.substring(0, startIndex) + newStyles + '\n';
fs.writeFileSync(filePath, newContent);
console.log('styles updated successfully!');
