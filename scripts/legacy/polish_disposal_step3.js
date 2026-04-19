const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'app/disposal/index.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const startToken = '{/* ── Uber-style Truck selector ── */}';
const endToken = '                numberOfLines={3}\n              />\n            </ScrollView>';

const startIndex = content.indexOf(startToken);
const endIndex = content.indexOf(endToken) + endToken.length;

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.slice(0, startIndex);
  const after = content.slice(endIndex);

  const newUX = `{/* ── Uber-style Ride selector ── */}
            <View style={{ gap: 12, marginBottom: 32, marginTop: 8 }}>
              {TIPPER_TRUCKS.map((t) => {
                const isSel = selectedTruckType === t.type;
                const priceFrom = t.fromPrice * (isSel ? numTrucks : 1);
                
                return (
                  <TouchableOpacity
                    key={t.type}
                    style={{
                      backgroundColor: colors.bgCard,
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: isSel ? 2 : 1,
                      borderColor: isSel ? '#000000' : '#E5E7EB',
                      shadowColor: isSel ? '#000' : 'transparent',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.05,
                      shadowRadius: 10,
                      elevation: isSel ? 2 : 0,
                    }}
                    onPress={() => {
                      haptics.light();
                      setSelectedTruckType(t.type);
                      if (!isSel) setNumTrucks(1);
                    }}
                    activeOpacity={0.9}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 64, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <TruckIllustration type={t.type} height={32} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: isSel ? '700' : '600', color: colors.textPrimary }}>
                          {t.label}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                          {t.capacity} t · {t.volume} m³
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: isSel ? '800' : '600', color: colors.textPrimary }}>
                        €{priceFrom}
                      </Text>
                    </View>

                    {isSel && (
                      <View style={{ 
                        marginTop: 16, 
                        paddingTop: 16, 
                        borderTopWidth: 1, 
                        borderColor: '#F3F4F6',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                         <View>
                           <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '500' }}>Kopējais apjoms</Text>
                           <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                             ≈ {t.capacity * numTrucks} t · ≈ {t.volume * numTrucks} m³
                           </Text>
                         </View>

                         <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 24, padding: 4 }}>
                            <TouchableOpacity
                              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: numTrucks <= 1 ? 'transparent' : '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: numTrucks > 1 ? '#000' : 'transparent', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: numTrucks > 1 ? 2 : 0 }}
                              disabled={numTrucks <= 1}
                              onPress={() => { haptics.light(); setNumTrucks(n => n - 1); }}
                              activeOpacity={0.7}
                            >
                               <Text style={{ fontSize: 20, color: numTrucks <= 1 ? '#9CA3AF' : '#111827', fontWeight: '500' }}>−</Text>
                            </TouchableOpacity>
                            <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', minWidth: 32, textAlign: 'center' }}>
                              {numTrucks}
                            </Text>
                            <TouchableOpacity
                              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: numTrucks >= 6 ? 'transparent' : '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: numTrucks < 6 ? '#000' : 'transparent', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: numTrucks < 6 ? 2 : 0 }}
                              disabled={numTrucks >= 6}
                              onPress={() => { haptics.light(); setNumTrucks(n => n + 1); }}
                              activeOpacity={0.7}
                            >
                               <Text style={{ fontSize: 20, color: numTrucks >= 6 ? '#9CA3AF' : '#111827', fontWeight: '500' }}>+</Text>
                            </TouchableOpacity>
                         </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Optional details ── */}
            <View style={{ gap: 12 }}>
              <TextInput
                style={{
                  backgroundColor: colors.bgMuted,
                  borderRadius: 16,
                  borderWidth: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: colors.textPrimary,
                }}
                placeholder={\`Aptuvenais svars (piem. \${activeTruck.capacity * numTrucks} t)\`}
                placeholderTextColor="#9CA3AF"
                value={weightText}
                onChangeText={setWeightText}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <TextInput
                style={{
                  backgroundColor: colors.bgMuted,
                  borderRadius: 16,
                  borderWidth: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: colors.textPrimary,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
                placeholder="Papildu informācija (neobligāti)..."
                placeholderTextColor="#9CA3AF"
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>`;
  
  fs.writeFileSync(targetFile, before + newUX + after, 'utf8');
  console.log("Uber-style UI deeply polished!");
} else {
  console.log("Tokens not found.");
  // output ends for debugging
  console.log(content.indexOf(startToken), content.indexOf(endToken));
}
