import re

with open('/Users/dags/Desktop/b3hub/apps/mobile/app/(seller)/incoming.tsx', 'r') as f:
    text = f.read()

# 1. Remove EmptyState import
text = text.replace("import { EmptyState } from '@/components/ui/EmptyState';\n", "")

# 2. Update screen bg to #ffffff
text = text.replace('<ScreenContainer bg="#f2f2f7">', '<ScreenContainer bg="#ffffff">')

# 3. Replace the global empty state
old_empty_1 = """      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Inbox size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>{t.incoming.empty}</Text>
          <Text style={styles.emptyDesc}>{t.incoming.emptyDesc}</Text>
        </View>
      ) : ("""

new_empty_1 = """      {orders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyRing}>
            <View style={styles.emptyIconCircle}>
              <Inbox size={32} color="#111827" strokeWidth={1.5} />
            </View>
          </View>
          <Text style={styles.emptyTitle}>{t.incoming.empty}</Text>
          <Text style={styles.emptyDesc}>{t.incoming.emptyDesc}</Text>
        </View>
      ) : ("""
text = text.replace(old_empty_1, new_empty_1)

# 4. Replace the visibleOrders empty state
old_empty_2 = """          {visibleOrders.length === 0 && (
            <EmptyState
              icon={<Inbox size={36} color="#d1d5db" />}
              title="Nav pasūtījumu"
              subtitle="Šajā kategorijā nav pasūtījumu"
            />
          )}"""

new_empty_2 = """          {visibleOrders.length === 0 && (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyRing}>
                <View style={styles.emptyIconCircle}>
                  <Inbox size={32} color="#111827" strokeWidth={1.5} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>Nav pasūtījumu</Text>
              <Text style={styles.emptyDesc}>Šajā kategorijā nav pasūtījumu</Text>
            </View>
          )}"""
text = text.replace(old_empty_2, new_empty_2)

# 5. Update header styles
old_header = """  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827', flex: 1 },"""

new_header = """  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111827', flex: 1, letterSpacing: -0.5 },"""
text = text.replace(old_header, new_header)

# 6. Update chip styles
old_chips = """  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignSelf: 'flex-start',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },"""

new_chips = """  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    alignSelf: 'flex-start',
  },
  filterChipActive: {
    backgroundColor: '#111827',
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },"""
text = text.replace(old_chips, new_chips)

# 7. Update card styles
old_card = """  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },"""

new_card = """  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
    marginBottom: 4,
  },"""
text = text.replace(old_card, new_card)

# 8. Update empty styles
old_empty_styles = """  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },"""

new_empty_styles = """  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
  },"""
text = text.replace(old_empty_styles, new_empty_styles)

text = text.replace("container: { flex: 1, backgroundColor: '#f2f2f7' },", "container: { flex: 1, backgroundColor: '#ffffff' },")

with open('/Users/dags/Desktop/b3hub/apps/mobile/app/(seller)/incoming.tsx', 'w') as f:
    f.write(text)

print('Updated File!')