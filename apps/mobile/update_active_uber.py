import re

with open('app/(driver)/active.tsx', 'r') as f:
    code = f.read()

# 1. Imports
if "import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';" not in code:
    code = code.replace(
        "import { BottomSheet } from '@/components/ui/BottomSheet';",
        "import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';"
    )

# 2. Add ref to default export
if "bottomSheetRef = useRef" not in code:
    code = code.replace(
        "const locationSub = useRef<Location.LocationSubscription | null>(null);",
        "const locationSub = useRef<Location.LocationSubscription | null>(null);\n  const bottomSheetRef = useRef<BottomSheet>(null);"
    )

# 3. Add gesture handler root wrapper - already in layout, but we need to structure the return
# actually we just need to replace the bottomSheet view

# UI changes: Move the navigate and contact buttons to floating HUD above the bottom sheet
hud_code = """
      {/* ── Top Bar Overlay ── */}
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

      {/* ── Floating Map HUD ── */}
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
"""

# Replace top overlay
top_overlay_regex = r"\{\/\* ── Top Bar Overlay ── \*\/}.*?\{\/\* ── Bottom Sheet Overlay ── \*\/}"
code = re.sub(top_overlay_regex, hud_code + "\n\n      {/* ── Bottom Sheet Overlay ── */}", code, flags=re.DOTALL)

# 4. Replace the Bottom Sheet container View with bottom-sheet
sheet_start_regex = r"<View style=\{styles\.bottomSheet\}>\s*<View style=\{styles\.sheetHandle\} />"
sheet_start_repl = """<BottomSheet
        ref={bottomSheetRef}
        snapPoints={['35%', '85%']}
        index={0}
        backgroundStyle={styles.gorhomBackground}
        handleIndicatorStyle={styles.gorhomHandle}
        style={{ zIndex: 100 }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>"""
code = re.sub(sheet_start_regex, sheet_start_repl, code)

# 5. Fix closing tags for Bottom sheet
sheet_end_regex = r"\{\/\* ── Modal: Weight Ticket ── \*\/}"
sheet_end_repl = """</BottomSheetScrollView>\n      </BottomSheet>\n\n      {/* ── Modal: Weight Ticket ── */}"""
code = code.replace("{/* ── Modal: Weight Ticket ── */}", sheet_end_repl)

# 6. Make details not internally scrollable if BottomSheetScrollView handles it
# Replace ScrollView inside with simple View
code = code.replace("<ScrollView\n            style={styles.expandedContent}\n            contentContainerStyle={{ paddingBottom: 24 }}\n            showsVerticalScrollIndicator={false}\n          >", "<View style={[styles.expandedContent, { paddingBottom: 24 }]}>")
code = code.replace("</ScrollView>", "</View>")

# Remove the actionRow handleNavigate button since it's in the HUD now
nav_btn_regex = r"<TouchableOpacity style=\{styles\.navButton\} onPress=\{handleNavigate\}>.*?<\/TouchableOpacity>"
code = re.sub(nav_btn_regex, "", code, flags=re.DOTALL)

# Also remove the specific contact buttons if we want them handled by HUD entirely, 
# although we can keep chat. For now we will keep them as secondary in the details but remove them from details since they are in HUD.

# Add styles for the new elements
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
    bottom: '40%', // slightly above the 35% bottom sheet
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  hudButtonGroup: {
    gap: 12,
  },
  hudButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
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

code = code.replace("bottomSheet: {", styles_to_add + "\n  bottomSheet: {")

with open('app/(driver)/active.tsx', 'w') as f:
    f.write(code)

print("Patch applied")
