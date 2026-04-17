const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'app/disposal/index.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// replace label
const oldCtaLabel = "const ctaLabel = step === 4 ? `Pasūtīt — no €${activeTruck.fromPrice * numTrucks}` : 'Turpināt';";
const newCtaLabel = "const ctaLabel = step === 4 ? `Pasūtīt — no €${activeTruck.fromPrice * numTrucks}` : step === 3 ? `Turpināt • no €${activeTruck.fromPrice * numTrucks}` : 'Turpināt';";
content = content.replace(oldCtaLabel, newCtaLabel);

const startRegex = /\{\/\* ── Truck type selector ── \*\/\}/;
const endRegex = /numberOfLines=\{3\}\s*\/>\s*<\/ScrollView>/;

const startMatch = content.match(startRegex);
const endMatch = content.match(endRegex);

if (startMatch && endMatch) {
  const startIndex = startMatch.index;
  const endIndex = endMatch.index + endMatch[0].length;

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
                        borderColor: '#E5E7EB',
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
            <View style={{ gap: 12, paddingBottom: 16 }}>
              <TextInput
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 16,
                  borderWidth: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  fontSize: 15,
                  color: colors.textPrimary,
                }}
                placeholder={\`Neobligāti: Aptuvenais svars (piem. \${activeTruck.capacity * numTrucks} t)\`}
                placeholderTextColor="#9CA3AF"
                value={weightText}
                onChangeText={setWeightText}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <TextInput
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 16,
                  borderWidth: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  fontSize: 15,
                  color: colors.textPrimary,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
                placeholder="Neobligāti: Papildu informācija autovadītājam..."
                placeholderTextColor="#9CA3AF"
                value={desc}
                onChangeText={setDesc}
                multiline
              />
            </View>
          </ScrollView>`;
  fs.writeFileSync(targetFile, before + newUX + after, 'utf8');
  console.log("Final UI rebuilt cleanly with Regex!");
} else {
  console.log("Tokens not found.");
}
