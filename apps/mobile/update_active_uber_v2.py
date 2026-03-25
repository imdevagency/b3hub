import re

with open('app/(driver)/active.tsx', 'r') as f:
    code = f.read()

replacement = """
      {/* ── Top Bar Overlay (HUD) ── */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>

        {job.sla?.isOverdue && (
          <View style={styles.slaBadge}>
            <Clock size={16} color="#dc2626" />
            <Text style={styles.slaText}>-{job.sla.overdueMinutes} min</Text>
          </View>
        )}
      </View>

      {/* ── Floating Nav & Call HUD ── */}
      <View style={styles.hudContainer} pointerEvents="box-none">
        <View style={styles.hudButtonGroup}>
          <TouchableOpacity style={styles.hudButton} onPress={handleNavigate} activeOpacity={0.8}>
            <Navigation2 size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.hudButton, { backgroundColor: '#fff' }]} onPress={() => handleCall(job.order?.siteContactPhone, job.order?.siteContactName)} activeOpacity={0.8}>
            <Phone size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Fluid Bottom Sheet ── */}
      <GorhomBottomSheet
        ref={bottomSheetRef}
        snapPoints={['35%', '85%']}
        index={0}
        backgroundStyle={styles.gorhomBackground}
        handleIndicatorStyle={styles.gorhomHandle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {/* ── Step progress ── */}
          <View style={{ flexDirection: 'row', gap: 3, marginBottom: 14 }}>
            {STATUS_STEPS.map((step, i) => (
              <View
                key={step}
                style={{
                  flex: i === currentIndex ? 2 : 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i <= currentIndex ? '#111827' : '#e5e7eb',
                  opacity: i < currentIndex ? 0.3 : 1,
                }}
              />
            ))}
          </View>

          {/* Minimal Header: Phase */}
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: phaseColor.bg }]}>
              <Text style={[styles.statusPillText, { color: phaseColor.text }]}>
                {currentStatus === 'EN_ROUTE_PICKUP'
                  ? 'CEĻĀ UZ IEKRAUŠANU'
                  : currentStatus === 'EN_ROUTE_DELIVERY'
                    ? 'CEĻĀ UZ IZKRAUŠANU'
                    : (t.activeJob.status[currentStatus] ?? currentStatus)}
              </Text>
            </View>
            <Text style={styles.jobIdText}>#{job.jobNumber}</Text>
          </View>

          {/* Main Context: Title & Address */}
          <Text style={styles.sheetTitle} numberOfLines={1} adjustsFontSizeToFit>
            {currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP'
              ? 'Dodies uz iekraušanu'
              : currentStatus === 'AT_PICKUP'
                ? 'Iekraušana objektā'
                : currentStatus === 'LOADED' || currentStatus === 'EN_ROUTE_DELIVERY'
                  ? 'Dodies uz izkraušanu'
                  : 'Piegāde objektā'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 }}>
            <MapPin size={16} color="#6b7280" />
            <Text style={styles.sheetAddress} numberOfLines={1}>
              {currentStatus === 'ACCEPTED' ||
              currentStatus === 'EN_ROUTE_PICKUP' ||
              currentStatus === 'AT_PICKUP'
                ? `${job.pickupAddress}, ${job.pickupCity}`
                : `${job.deliveryAddress}, ${job.deliveryCity}`}
            </Text>
          </View>

          {/* Primary Action Button */}
          <View style={styles.actionRow}>
            {nextStatus ? (
              <TouchableOpacity style={[styles.primaryButton]} onPress={handleUpdateStatus}>
                <Text style={styles.primaryButtonText}>
                  {currentStatus === 'AT_DELIVERY'
                    ? t.deliveryProof.title
                    : currentStatus === 'AT_PICKUP'
                      ? 'Apstiprināt kravu'
                      : t.activeJob.status[nextStatus]}
                </Text>
                {currentStatus !== 'AT_DELIVERY' && (
                  <Text style={{ color: '#ffffff80', fontSize: 18 }}>→</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.completedBanner}>
                <CheckCircle2 size={20} color="#365314" />
                <Text style={styles.completedText}>Piegādāts!</Text>
              </View>
            )}
          </View>

          {/* Main Details (Revealed by pulling up) */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Materiāls</Text>
            <Text style={styles.detailValue}>{job.cargoType}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Svars</Text>
            <Text style={styles.detailValue}>{job.cargoWeight ?? '-'} t</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cena</Text>
            <Text style={styles.detailValue}>€{job.rate.toFixed(2)}</Text>
          </View>

          {/* Exceptions Entry Point */}
          <Text style={[styles.detailLabel, { marginTop: 16, marginBottom: 8 }]}>
            Izņēmumi / Problēmas
          </Text>
          <View style={styles.exceptionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="#ef4444" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#7f1d1d' }}>
                Ziņot par problēmu
              </Text>
            </View>
            <TextInput
              style={{
                backgroundColor: '#fff',
                borderRadius: 8,
                padding: 8,
                height: 60,
                fontSize: 13,
              }}
              placeholder="Aprakstiet situāciju..."
              value={exceptionNotes}
              onChangeText={setExceptionNotes}
              multiline
            />
            <TouchableOpacity
              style={{
                backgroundColor: '#fee2e2',
                borderRadius: 8,
                padding: 10,
                alignItems: 'center',
              }}
              onPress={handleReportException}
            >
              <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 13 }}>
                Ziņot dispečeram
              </Text>
            </TouchableOpacity>
          </View>

          {/* Return Trips List (if any) */}
          {returnTrips.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}
              >
                <Route size={16} color="#000" />
                <Text style={{ fontWeight: '700', fontSize: 14 }}>Atpakaļceļa kravas</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {returnTrips.map((rt) => (
                  <View
                    key={rt.id}
                    style={{
                      width: 220,
                      padding: 12,
                      backgroundColor: '#f3f4f6',
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 14 }}>
                      €{rt.rate.toFixed(0)} · {rt.returnDistanceKm} km
                    </Text>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      {rt.pickupCity} → {rt.deliveryCity}
                    </Text>
                    <TouchableOpacity
                      style={{
                        marginTop: 8,
                        backgroundColor: '#000',
                        padding: 8,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                      onPress={() =>
                        handleAcceptReturnTrip(rt.id, rt.pickupCity, rt.deliveryCity)
                      }
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                        Pieņemt
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

        </BottomSheetScrollView>
      </GorhomBottomSheet>
"""

# Regex replacement from `<View style={styles.topOverlay}>` up to `</View>` right before the modal comment.
pattern = r"      \{\/\* ── Top Bar Overlay ── \*\/\}.*?      <\/View>(?=\n\n      \{\/\* ── Weight Ticket Modal \(Original\) ── \*\/\})"
code = re.sub(pattern, replacement.strip('\n'), code, flags=re.DOTALL)

# Add imports for Gorhom bottom sheet
if "import GorhomBottomSheet" not in code:
    code = code.replace(
        "import { BottomSheet } from '@/components/ui/BottomSheet';",
        "import { BottomSheet } from '@/components/ui/BottomSheet';\nimport GorhomBottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';"
    )

# Add ref
if "bottomSheetRef" not in code:
    code = code.replace(
        "const locationSub = useRef<Location.LocationSubscription | null>(null);",
        "const locationSub = useRef<Location.LocationSubscription | null>(null);\n  const bottomSheetRef = useRef<GorhomBottomSheet>(null);"
    )

styles_to_add = """
  gorhomBackground: {
    backgroundColor: '#fff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  gorhomHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginTop: 8,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  hudContainer: {
    position: 'absolute',
    right: 16,
    bottom: '42%',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  hudButtonGroup: {
    gap: 12,
  },
  hudButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  slaBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  slaText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
"""

if "gorhomBackground: {" not in code:
    code = code.replace("bottomSheet: {", styles_to_add + "\n  bottomSheet: {")

with open('app/(driver)/active.tsx', 'w') as f:
    f.write(code)

print("Patch applied.")
