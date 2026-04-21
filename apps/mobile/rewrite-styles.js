const fs = require('fs');

const stylesPath = 'app/(buyer)/order/order-detail-styles.ts';
let styles = fs.readFileSync(stylesPath, 'utf-8');

const newStyles = `
  floatingHeader: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  floatingBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  floatingTitlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    gap: 8,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  floatingOrderNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  floatingEta: {
    position: 'absolute',
    top: 120, // below header
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  minimalDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 16,
  },
  callBtnMinimal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
`;

styles = styles.replace('});', newStyles + '});');
fs.writeFileSync(stylesPath, styles);
