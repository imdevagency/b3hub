const fs = require('fs');
const filepath = 'app/(buyer)/home.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Imports
content = content.replace(
    "import { TopBar } from '@/components/ui/TopBar';",
    "import { TopBar } from '@/components/ui/TopBar';\nimport { StatusPill } from '@/components/ui/StatusPill';\nimport { EmptyState } from '@/components/ui/EmptyState';"
);

// 2. Add StatusColors helper
const helper_code = `
function getStatusColors(status: string) {
  if (!status) return { bg: '#f3f4f6', text: '#4b5563' };
  const s = status.toUpperCase();
  if (['CONFIRMED', 'ACCEPTED', 'IN_PROGRESS'].includes(s)) return { bg: '#dcfce7', text: '#166534' };
  if (['COMPLETED', 'DELIVERED'].includes(s)) return { bg: '#f1f5f9', text: '#475569' };
  if (['PENDING', 'SUBMITTED', 'OPEN'].includes(s)) return { bg: '#fff7ed', text: '#9a3412' };
  if (['CANCELLED', 'REJECTED'].includes(s)) return { bg: '#fef2f2', text: '#991b1b' };
  return { bg: '#f3f4f6', text: '#4b5563' };
}

export default function HomeScreen() {`;
content = content.replace("export default function HomeScreen() {", helper_code);

// 3. Add rawStatus to getRecentItems (3 times)
content = content.replace(
    /status: STATUS_LABEL\[o\.status\] \?\? o\.status,\n\s*kind: 'mat',/g,
    "status: STATUS_LABEL[o.status] ?? o.status,\n          rawStatus: o.status,\n          kind: 'mat',"
);
content = content.replace(
    /status: o\.status === 'COMPLETED' \? 'Pabeigts' : o\.status,\n\s*kind: 'skip',/g,
    "status: o.status === 'COMPLETED' ? 'Pabeigts' : o.status,\n          rawStatus: o.status,\n          kind: 'skip',"
);
content = content.replace(
    /status: o\.status === 'DELIVERED' \? 'Piegādāts' : o\.status,\n\s*kind: 'transport',/g,
    "status: o.status === 'DELIVERED' ? 'Piegādāts' : o.status,\n          rawStatus: o.status,\n          kind: 'transport',"
);

// 4. Replace Recent List JSX
const old_recent_list = `        <View style={s.recentList}>
          {recentOrders.length > 0 ? (
            recentOrders.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={s.recentRow}
                onPress={() => {
                  haptics.light();
                  const route =
                    item.kind === 'skip'
                      ? \`/(buyer)/skip-order/\${item.id}\`
                      : item.kind === 'transport'
                        ? \`/(buyer)/transport-job/\${item.id}\`
                        : \`/(buyer)/order/\${item.id}\`;
                  router.push(route as any);
                }}
              >
                <View style={s.recentIconSmall}>
                  {item.kind === 'transport' ? (
                    <Truck size={16} color="#6b7280" />
                  ) : (
                    <Package size={16} color="#6b7280" />
                  )}
                </View>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={s.recentRowTitle}>
                        {item.kind === 'mat'
                          ? 'Materiāli'
                          : item.kind === 'skip'
                            ? 'Konteiners'
                            : 'Transports'}
                      </Text>
                      <Text
                        style={[
                          s.recentStatusText,
                          item.status.includes('CANCEL') || item.status.includes('Atcelts')
                            ? { color: '#ef4444' }
                            : item.status.includes('Piegādāts')
                              ? { color: '#10b981' }
                              : {},
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                    <Text style={s.recentRowSub} numberOfLines={1}>
                      {item.sub}
                    </Text>
                    <Text style={s.recentRowDate}>
                      {item.num}
                      {item.date
                        ? ' • ' +
                          new Date(item.date).toLocaleDateString('lv', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : ''}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color="#d1d5db" />
              </TouchableOpacity>
            ))
          ) : loading ? (
            <View style={{ gap: 10, paddingHorizontal: 20 }}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 52,
                    backgroundColor: '#e5e7eb',
                    borderRadius: 12,
                    opacity: 1 - i * 0.15,
                  }}
                />
              ))}
            </View>
          ) : isNewUser ? (
            <View style={s.emptyHint}>
              <Text style={s.emptyHintText}>Nav jaunu pasūtījumu</Text>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  router.push('/(buyer)/catalog' as any);
                }}
              >
                <Text style={s.emptyHintLink}>Sākt pasūtīt →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={s.emptyRecent}>Pabeigti pasūtījumi parādīsies šeit</Text>
          )}
        </View>`;

const new_recent_list = `        <View style={s.recentListWrapper}>
          {recentOrders.length > 0 ? (
            recentOrders.map((item, index) => {
              const statusColors = getStatusColors(item.rawStatus);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.recentRow, index === recentOrders.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => {
                    haptics.light();
                    const route =
                      item.kind === 'skip'
                        ? \`/(buyer)/skip-order/\${item.id}\`
                        : item.kind === 'transport'
                          ? \`/(buyer)/transport-job/\${item.id}\`
                          : \`/(buyer)/order/\${item.id}\`;
                    router.push(route as any);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.recentIconSmall}>
                    {item.kind === 'mat' ? (
                      <HardHat size={18} color="#64748b" />
                    ) : item.kind === 'transport' ? (
                      <Truck size={18} color="#64748b" />
                    ) : (
                      <Package size={18} color="#64748b" />
                    )}
                  </View>
                  <View style={s.recentRowContent}>
                    <View style={s.recentRowHeader}>
                      <Text style={s.recentRowTitle}>
                        {item.kind === 'mat'
                          ? 'Materiāli'
                          : item.kind === 'skip'
                            ? 'Konteiners'
                            : 'Transports'}
                      </Text>
                      <StatusPill 
                        label={item.status} 
                        bg={statusColors.bg} 
                        color={statusColors.text} 
                        size="sm" 
                      />
                    </View>
                    <Text style={s.recentRowSub} numberOfLines={1}>
                      {item.sub}
                    </Text>
                    <Text style={s.recentRowDate}>
                      {item.num}
                      {item.date
                        ? ' • ' +
                          new Date(item.date).toLocaleDateString('lv', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : ''}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#94a3b8" style={{ alignSelf: 'center' }} />
                </TouchableOpacity>
              );
            })
          ) : loading ? (
            <View style={{ gap: 10, padding: 16 }}>
              {[1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 52,
                    backgroundColor: '#e5e7eb',
                    borderRadius: 12,
                    opacity: 1 - i * 0.15,
                  }}
                />
              ))}
            </View>
          ) : isNewUser ? (
            <View style={s.emptyRecentWrapper}>
              <EmptyState
                icon={<Package size={32} color="#94a3b8" />}
                title="Nav pasūtījumu"
                subtitle="Sāciet jaunu pasūtījumu, lai redzētu vēsturi šeit."
                action={
                  <TouchableOpacity
                    style={{ marginTop: 24, backgroundColor: '#111827', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
                    onPress={() => router.push('/(buyer)/catalog' as any)}
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Sākt pasūtīt</Text>
                  </TouchableOpacity>
                }
              />
            </View>
          ) : (
            <View style={s.emptyRecentWrapper}>
              <Text style={s.emptyRecent}>Pabeigti pasūtījumi parādīsies šeit</Text>
            </View>
          )}
        </View>`;

content = content.replace(old_recent_list, new_recent_list);

// 5. Styles
const old_service_chip = `  serviceChip: {
    width: 104,
    height: 104,
    backgroundColor: '#F4F4F5',
    borderRadius: 20,
    padding: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  serviceChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },`;

const new_service_chip = `  serviceChip: {
    width: 104,
    height: 104,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  serviceChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },`;
content = content.replace(old_service_chip, new_service_chip);

const old_recent_styles_base = content.split("  recentHeader: {")[1].split("  emptyHintLink:")[0];
// Let's use regex for recent styles part
const styleBlockRe = /recentHeader: \{[\s\S]*?emptyHintLink: \{\s*fontSize: 15,\s*color: '#111827',\s*fontWeight: '700',\s*\},/;

const new_recent_styles = `recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 12,
  },
  seeAllLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  recentListWrapper: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  recentList: {
    backgroundColor: '#f2f2f7',
    marginHorizontal: 0,
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 24,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  recentIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  recentRowContent: {
    flex: 1,
    marginRight: 8,
  },
  recentRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.3,
  },
  recentRowSub: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#64748b',
    marginTop: 4,
  },
  recentRowDate: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyRecentWrapper: {
    paddingVertical: 16,
  },
  emptyRecent: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 32,
    fontSize: 14,
    fontWeight: '500',
  },`;
content = content.replace(styleBlockRe, new_recent_styles);

const old_nudge = \`  profileNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
  },
  profileNudgeText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '600',
  },\`;
const new_nudge = \`  profileNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  profileNudgeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#92400e',
    lineHeight: 20,
  },\`;
content = content.replace(old_nudge, new_nudge);

fs.writeFileSync(filepath, content);
console.log('JS Patch applied successfully');
