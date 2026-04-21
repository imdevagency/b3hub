const fs = require('fs');

const file = fs.readFileSync('app/(buyer)/order/[id].tsx', 'utf-8');

// Find imports and add BottomSheet
let newFile = file.replace(
  "import { StatusPill } from '@/components/ui/StatusPill';",
  "import { StatusPill } from '@/components/ui/StatusPill';\nimport BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';"
);

// We need to replace the entire return block.
const returnStartStr = '  return (\n    <ScreenContainer bg="#f4f5f7">';
// Find where the function ends 
const returnStartPos = newFile.indexOf(returnStartStr);

let beforeReturn = newFile.slice(0, returnStartPos);

let beforeExport = beforeReturn;

const newReturn = `
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = React.useMemo(() => ['25%', '50%', '90%'], []);

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f5f7' }}>
      {/* ── Background Map ────────────────────────────────────── */}
      <View style={[StyleSheet.absoluteFillObject]}>
        <BaseMap
          cameraRef={cameraRef}
          center={
            driverLocationOnMap
              ? [driverLocationOnMap.lng, driverLocationOnMap.lat]
              : order.deliveryLng && order.deliveryLat
                ? [order.deliveryLng, order.deliveryLat]
                : [24.1052, 56.9496]
          }
          zoom={13}
          style={{ flex: 1 }}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={() => setMapReady(true)}
        >
          {/* Delivery pin */}
          {order.deliveryLat != null && order.deliveryLng != null && Marker && (
            <Marker coordinate={{ latitude: order.deliveryLat, longitude: order.deliveryLng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={s.pinDelivery}>
                <MapPin size={14} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
          {/* Live driver marker */}
          {driverLocationOnMap && Marker && (
            <Marker coordinate={{ latitude: driverLocationOnMap.lat, longitude: driverLocationOnMap.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={s.pinDriver}>
                <Truck size={13} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
        </BaseMap>
      </View>

      {/* ── Floating Header ────────────────────────────────────── */}
      <View style={s.floatingHeader}>
        <TouchableOpacity style={s.floatingBackBtn} onPress={() => router.back()}>
          <CheckCircle size={20} color="#111827" /> {/* Placeholder back icon */}
        </TouchableOpacity>
        <View style={s.floatingTitlePill}>
          <Text style={s.floatingOrderNumber}>#{order.orderNumber}</Text>
          <StatusPill label={st.label} bg="#f3f4f6" color="#111827" size="sm" />
        </View>
      </View>

      {/* ── ETA Floating Chip (if active job) ──────────────────── */}
      {activeJob && (
        <View style={s.floatingEta}>
          <View style={s.mapEtaDot} />
          <Text style={s.mapEtaText}>
            {etaMin != null ? \`Pienāks ~\${etaMin} min\` : 'Šoferis ir ceļā'}
          </Text>
        </View>
      )}

      {/* ── Bottom Sheet ───────────────────────────────────────── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{ borderRadius: 24 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          
          {/* Driver Card */}
          {driver && (
            <View style={s.minimalDriverCard}>
              {driver.avatar ? (
                <Image source={{ uri: driver.avatar }} style={s.driverAvatar} />
              ) : (
                <View style={s.driverAvatarFallback}>
                  <Text style={s.driverAvatarInitials}>
                    {driver.firstName?.[0] ?? '?'}
                    {driver.lastName?.[0] ?? ''}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.driverName}>{driver.firstName} {driver.lastName}</Text>
                {vehicle ? <Text style={s.driverPlate}>{vehicle.licensePlate}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {driver.phone && (
                  <TouchableOpacity style={s.callBtnMinimal} onPress={() => Linking.openURL(\`tel:\${driver.phone}\`).catch(() => null)}>
                    <Phone size={18} color="#111827" />
                  </TouchableOpacity>
                )}
                 <TouchableOpacity style={s.callBtnMinimal} onPress={() => router.push({ pathname: '/chat/[jobId]', params: { jobId: activeJob.id, title: \`\${driver.firstName} \${driver.lastName}\` }})}>
                    <MessageCircle size={18} color="#111827" />
                 </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Surcharges & Actions (Swipe up to see more) */}
          <View style={{ marginTop: 24 }}>
            {canPay && (
              <TouchableOpacity style={[s.primaryActionBtn, payLoading && { opacity: 0.6 }, { marginBottom: 16 }]} onPress={handlePay} disabled={payLoading}>
                <CreditCard size={18} color="#fff" />
                <Text style={s.primaryActionBtnText}>Maksāt €{order.total.toFixed(2)}</Text>
              </TouchableOpacity>
            )}

            {order.status === 'DELIVERED' && (
              <TouchableOpacity style={[s.primaryActionBtn, { backgroundColor: disputeFiled ? '#9ca3af' : '#16a34a', marginBottom: 16 }]} onPress={handleConfirmReceipt} disabled={actionLoading || disputeFiled}>
                <CheckCircle size={18} color="#fff" />
                <Text style={s.primaryActionBtnText}>Apstiprināt saņemšanu</Text>
              </TouchableOpacity>
            )}

            <InfoSection icon={<Package size={14} color="#111827" />} title="Preces">
              <View style={s.totalRowFinal}>
                <Text style={s.totalLabelFinal}>Kopā</Text>
                <Text style={s.totalValueFinal}>€{order.total.toFixed(2)}</Text>
              </View>
            </InfoSection>

            <InfoSection icon={<MapPin size={14} color="#111827" />} title="Piegāde">
              <DetailRow label="Adrese" value={\`\${order.deliveryAddress}\\n\${order.deliveryCity}\`} last />
            </InfoSection>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {canCancel && (
                <TouchableOpacity style={[{ flex: 1 }, s.secondaryActionBtn, s.secondaryActionBtnDanger]} onPress={handleCancel} disabled={actionLoading}>
                  <Text style={s.secondaryActionBtnDangerText}>Atcelt</Text>
                </TouchableOpacity>
              )}
              {canManageOrders && canCancel && (
                <TouchableOpacity style={[{ flex: 1 }, s.secondaryActionBtn]} onPress={() => setShowAmend(true)}>
                  <Text style={s.secondaryActionBtnText}>Labot</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

        </BottomSheetScrollView>
      </BottomSheet>
      
      {/* Sheets & Modals */}
      {id && token && <RatingModal visible={showRating} onClose={() => setShowRating(false)} onSuccess={() => { setShowRating(false); setRatedLocally(true); }} token={token} orderId={id} />}
      {order && token && <DisputeSheet visible={showDispute} onClose={() => setShowDispute(false)} order={order} token={token} onFiled={() => { setDisputeFiled(true); setDisputeResultVisible(true); }} />}
      {order && token && <AmendSheet visible={showAmend} onClose={() => setShowAmend(false)} order={order} token={token} onSuccess={load} />}
      <ActionResultSheet visible={cancelResultVisible} onClose={() => setCancelResultVisible(false)} variant="cancelled" title="Pasūtījums atcelts" subtitle="Jūsu pasūtījums ir atcelts." primaryLabel="Pasūtīt no jauna" onPrimary={() => { setCancelResultVisible(false); router.replace({ pathname: '/material-order' }); }} secondaryLabel="Mani pasūtījumi" onSecondary={() => { setCancelResultVisible(false); router.replace('/(buyer)/orders'); }} />
      <ActionResultSheet visible={disputeResultVisible} onClose={() => setDisputeResultVisible(false)} variant="info" title="Sūdzība iesniegta" subtitle="Mēs izskatīsim jūsu paziņojumu." primaryLabel="Labi" onPrimary={() => setDisputeResultVisible(false)} />

    </View>
  );
}
`;

fs.writeFileSync('app/(buyer)/order/[id].tsx', beforeReturn + newReturn);
