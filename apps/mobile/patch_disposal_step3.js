const fs = require('fs');
let content = fs.readFileSync('app/disposal/index.tsx', 'utf-8');

// 1. countCard styling
content = content.replace(
`  countCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderWidth: 0,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroIllZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1.5,
    borderBottomColor: '#f3f4f6',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },`,
`  countCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderWidth: 0,
    overflow: 'hidden',
    marginBottom: 24,
  },
  heroIllZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },`
);

// 2. stepper button states
content = content.replace(
`  stepperBtnDim: { backgroundColor: '#e5e7eb' },`,
`  stepperBtnDim: { opacity: 0.3 },`
);

// 3. liveStats block to be transparent like Step 4
content = content.replace(
`  liveStats: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderWidth: 0,
    padding: 14,
    marginBottom: 16,
  },
  liveStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e5e7eb',
  },
  liveStatLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  liveStatValue: { fontSize: 15, color: '#374151', fontWeight: '600' },`,
`  liveStats: {
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  liveStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  liveStatLabel: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  liveStatValue: { fontSize: 15, color: '#111827', fontWeight: '600' },`
);

// Remove the inline bottom border reset on the last stat row, or fix it to match
content = content.replace(
`              <View style={[s.liveStatRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={s.liveStatLabel}>Cena</Text>
                <Text style={[s.liveStatValue, { color: '#111827', fontWeight: '700' }]}>`,
`              <View style={[s.liveStatRow, { borderBottomWidth: 0 }]}>
                <Text style={s.liveStatLabel}>Kopējā cena (no)</Text>
                <Text style={[s.liveStatValue, { fontSize: 18, fontWeight: '800' }]}>`
);

// Change the first sectionLabel from "Transportlīdzekļa veids" to just "Lielums/Veids" or similar, wait don't change wording unless needed. Look at section labels.

fs.writeFileSync('app/disposal/index.tsx', content);
console.log('Step 3 polished!');
