import re
import sys

def run():
    with open('/Users/dags/Desktop/b3hub/apps/mobile/app/(seller)/quotes.tsx', 'r') as f:
        content = f.read()

    # 1. We want to replace RequestCard 
    
    request_card_new = """function RequestCard({ request, myCompanyId, onRespond }: RequestCardProps) {
  const [expanded, setExpanded] = useState(false);

  const alreadyResponded =
    !!myCompanyId && request.responses.some((r) => r.supplierId === myCompanyId);
  const responseCount = request.responses.length;
  const categoryLabel = sq.categories[request.materialCategory] ?? request.materialCategory;
  const unitLabel = sq.units[request.unit] ?? request.unit;

  const statusText = request.status === 'QUOTED' ? ({ text: sq.quotedBadge, color: '#2563eb' }) : ({ text: sq.openBadge, color: '#d97706' });

  return (
    <View style={[styles.card, alreadyResponded && styles.cardResponded]}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTopLeft}>
          <Text style={styles.materialText} numberOfLines={1}>{request.materialName || categoryLabel} • {request.quantity}{unitLabel}</Text>
          <Text style={styles.buyerText}>{request.deliveryCity} ({timeAgo(request.createdAt)})</Text>
        </View>

        <View style={styles.cardTopRight}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.statusDot, { backgroundColor: statusText.color }]} />
            <Text style={[styles.statusText, { color: statusText.color }]}>{statusText.text}</Text>
          </View>
          {responseCount > 0 && (
            <Text style={styles.responseCountText}>{responseCount} piedāv.</Text>
          )}
          <View style={{ marginTop: 4 }}>
            {expanded ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedBody}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{sq.postedBy}:</Text>
            <Text style={styles.detailValue}>
              {request.buyer.firstName} {request.buyer.lastName.charAt(0)}.
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{sq.quantity}:</Text>
            <Text style={styles.detailValue}>
              {request.quantity} {unitLabel} • {categoryLabel}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{sq.deliverTo}:</Text>
            <Text style={styles.detailValue}>{request.deliveryCity}</Text>
          </View>

          {request.notes ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{sq.notes}:</Text>
              <Text style={styles.detailValue}>{request.notes}</Text>
            </View>
          ) : null}

          <Text style={styles.requestNumber}>#{request.requestNumber}</Text>

          {alreadyResponded ? (
            <View style={styles.alreadyRespondedBox}>
              <CheckCircle2 size={16} color={'#111827'} />
              <Text style={styles.alreadyRespondedText}>{sq.alreadyResponded}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.respondBtn}
              onPress={() => onRespond(request)}
              activeOpacity={0.8}
            >
              <Text style={styles.respondBtnText}>{sq.submitBtn}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}"""

    # Replace RequestCard
    pattern_card = re.compile(r'function RequestCard\(\{ request, myCompanyId, onRespond \}: RequestCardProps\) \{.*?(?=\n// ── Main Screen)', re.DOTALL | re.MULTILINE)
    content = pattern_card.sub(request_card_new + '\n', content)

    # Replace Main Screen rendering
    screen_pattern = re.compile(r'  return \(\n    <ScreenContainer bg="#ffffff">.*?</ScreenContainer>\n  \);', re.DOTALL)
    
    new_screen = """  return (
    <ScreenContainer bg="white">
      <View style={styles.header}>
        <Text style={styles.heroTitle}>{sq.title}</Text>
      </View>

      {!loading && requests.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>
              {requests.length} aktīv{requests.length === 1 ? 's' : 'i'}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={{ padding: 24, gap: 16 }}>
          <SkeletonCard count={4} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, requests.length === 0 && { flexGrow: 1, justifyContent: 'center' }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
          }
          keyboardShouldPersistTaps="handled"
        >
          {requests.length === 0 ? (
            <View style={styles.emptyWrap}>
               <View style={styles.emptyIconWrap}>
                 <FileText size={32} color="#111827" />
               </View>
               <Text style={styles.emptyTitle}>Nav pieprasījumu</Text>
               <Text style={styles.emptyDesc}>Šobrīd nav neviena aktīva cenas pieprasījuma.</Text>
            </View>
          ) : (
            requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                myCompanyId={myCompanyId}
                onRespond={handleRespond}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Proposal Modal */}
      {modalRequest && token && (
        <ProposalModal
          request={modalRequest}
          visible={!!modalRequest}
          onClose={() => setModalRequest(null)}
          onSuccess={handleSuccess}
          token={token}
        />
      )}
    </ScreenContainer>
  );"""
    
    content = screen_pattern.sub(new_screen, content)

    # 3. Replace styles
    styles_pattern = re.compile(r'const styles = StyleSheet\.create\(\{.*\}\);', re.DOTALL)
    
    new_styles = """const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#ffffff',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  countChipText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    flex: 1,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24 },

  card: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  cardResponded: { opacity: 0.7 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTopLeft: { gap: 4, flex: 1, paddingRight: 10 },
  materialText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  buyerText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  
  cardTopRight: { alignItems: 'flex-end', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '600' },
  responseCountText: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginTop: 2 },

  expandedBody: {
    paddingTop: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: { fontSize: 14, color: '#6b7280', minWidth: 80 },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500', flex: 1, lineHeight: 20 },
  
  requestNumber: { fontSize: 12, color: '#9ca3af', marginTop: 12, marginBottom: 8 },

  alreadyRespondedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  alreadyRespondedText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  
  respondBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  respondBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  // Modal styles (unchanged)
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12 },
  priceInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: '700', color: '#111827' },
  priceUnit: { paddingHorizontal: 16, paddingVertical: 16 },
  priceUnitText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, alignSelf: 'flex-start' },
  stepBtn: { paddingHorizontal: 20, paddingVertical: 14 },
  stepValue: { paddingHorizontal: 24, fontSize: 20, fontWeight: '700', color: '#111827', minWidth: 48, textAlign: 'center' },
  notesInput: { backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, color: '#111827', height: 100, textAlignVertical: 'top' },
  totalPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginTop: 16 },
  totalPreviewLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  totalPreviewValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111827', borderRadius: 12, paddingVertical: 16, marginTop: 24 },
  submitBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  successBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  successMsg: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
});"""
    content = styles_pattern.sub(new_styles, content)

    with open('/Users/dags/Desktop/b3hub/apps/mobile/app/(seller)/quotes.tsx', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    run()