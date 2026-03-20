const fs = require('fs');
const file = 'components/wizard/InlineAddressStep.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(
  `  searchBox: {`,
  `  timelineWrap: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9ca3af',
    marginLeft: 6,
  },
  timelineText: {
    flex: 1,
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  timelineLine: {
    width: 2,
    height: 16,
    backgroundColor: '#e5e7eb',
    marginLeft: 9,
    marginTop: 4,
    marginBottom: -4,
  },
  searchBox: {`
);

fs.writeFileSync(file, txt);
