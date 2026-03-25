import re
import os

with open("/Users/dags/Desktop/b3hub/tmp_gorhom.txt", "r") as f:
    old_sheet = f.read()

with open("/Users/dags/Desktop/b3hub/tmp_new_bottom.txt", "r") as f:
    new_sheet = f.read()

with open("/Users/dags/Desktop/b3hub/apps/mobile/app/(driver)/active.tsx", "r") as f:
    content = f.read()

if old_sheet in content:
    print("Found exact block, replacing...")
    content = content.replace(old_sheet, new_sheet)
else:
    print("WARNING: Exact block not found. Checking substrings...")

new_card_styles = """
  staticBottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  detailsPull: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  detailsPullHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#d1d5db',
    borderRadius: 3,
  },
"""

if "staticBottomCard:" not in content:
    content = content.replace("container: { flex: 1 },", "container: { flex: 1 }," + new_card_styles)

content = content.replace("import GorhomBottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';", "")

with open("/Users/dags/Desktop/b3hub/apps/mobile/app/(driver)/active.tsx", "w") as f:
    f.write(content)
print("Done.")
