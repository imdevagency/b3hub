const fs = require('fs');
let content = fs.readFileSync('app/disposal/index.tsx', 'utf-8');

// Replace the inline style on line 700ish
content = content.replace(
`                style={[
                  s.uberInput,
                  {
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: '#f3f4f6',
                    paddingHorizontal: 16,
                    marginBottom: 4,
                  },
                ]}`,
`                style={[
                  s.uberInput,
                  {
                    backgroundColor: '#f3f4f6',
                    borderRadius: 16,
                    borderWidth: 0,
                    paddingHorizontal: 16,
                    marginBottom: 4,
                  },
                ]}`
);

// Replace the inline style on line 730ish
content = content.replace(
`                style={[
                  s.uberInput,
                  s.uberInputMulti,
                  {
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: '#f3f4f6',
                    paddingHorizontal: 16,
                  },
                ]}`,
`                style={[
                  s.uberInput,
                  s.uberInputMulti,
                  {
                    backgroundColor: '#f3f4f6',
                    borderRadius: 16,
                    borderWidth: 0,
                    paddingHorizontal: 16,
                  },
                ]}`
);

// Fix countCard
content = content.replace(
`    countCard: {
      backgroundColor: '#fff',
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: '#f3f4f6',
      overflow: 'hidden',
      marginBottom: 14,
    },`,
`    countCard: {
      backgroundColor: '#f3f4f6',
      borderRadius: 18,
      borderWidth: 0,
      overflow: 'hidden',
      marginBottom: 14,
    },`
);

// Fix countHero (usually background #f9fafb, maybe make #f9fafb?)
// Let's modify liveStats
content = content.replace(
`    liveStats: {
      backgroundColor: '#fff',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#f3f4f6',
      padding: 14,
      marginBottom: 16,
    },`,
`    liveStats: {
      backgroundColor: '#f3f4f6',
      borderRadius: 16,
      borderWidth: 0,
      padding: 14,
      marginBottom: 16,
    },`
);

// Fix truckTypeCard
content = content.replace(
`  truckTypeCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#f3f4f6',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  truckTypeCardSel: { borderColor: '#111827', backgroundColor: '#111827' },
  truckIllZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  truckIllZoneSel: { backgroundColor: '#1f2937' },`,
`  truckTypeCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
  },
  truckTypeCardSel: { backgroundColor: '#111827' },
  truckIllZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
  },
  truckIllZoneSel: { backgroundColor: '#1f2937' },`
);

fs.writeFileSync('app/disposal/index.tsx', content);
console.log('Fixed inline and missing borders!');
