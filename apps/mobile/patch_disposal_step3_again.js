const fs = require('fs');
let s = fs.readFileSync('/Users/dags/Desktop/b3hub/apps/mobile/app/disposal/index.tsx', 'utf-8');

s = s.replace(
`  liveStats: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderWidth: 0,
    padding: 14,
    marginBottom: 16,
  },
  liveStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  liveStatLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  liveStatValue: {`,
`  liveStats: {
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  liveStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  liveStatLabel: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  liveStatValue: {`
);

// Update font weight and size on live stat value
s = s.replace(
`  liveStatValue: { flex: 1, textAlign: 'right', fontSize: 14, color: '#111827', fontWeight: '600' },`,
`  liveStatValue: { flex: 1, textAlign: 'right', fontSize: 15, color: '#111827', fontWeight: '600' },`
);

// We should also replace the JSX of the final row where "Cena" and total cost is displayed if it exists
s = s.replace(
`              <View style={[s.liveStatRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={s.liveStatLabel}>Cena</Text>
                <Text style={[s.liveStatValue, { color: '#111827', fontWeight: '700' }]}>
                  no €{activeTruck.fromPrice * numTrucks}
                </Text>`,
`              <View style={[s.liveStatRow, { borderBottomWidth: 0 }]}>
                <Text style={s.liveStatLabel}>Cena no</Text>
                <Text style={[s.liveStatValue, { fontSize: 18, color: '#111827', fontWeight: '800' }]}>
                  €{activeTruck.fromPrice * numTrucks}
                </Text>`
);

fs.writeFileSync('/Users/dags/Desktop/b3hub/apps/mobile/app/disposal/index.tsx', s);
console.log('Fixed live stats block!');
