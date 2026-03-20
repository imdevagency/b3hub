import re
import sys

with open('app/(driver)/active.tsx', 'r') as f:
    text = f.read()

# 1. Edge-to-Edge Map Card
text = text.replace("borderRadius={16}", "borderRadius={0}")
text = text.replace("style={styles.mapCard}", "style={[styles.mapCard, { marginHorizontal: -20, borderLeftWidth: 0, borderRightWidth: 0 }]} ")

# 2. Add full screen flex wrapper around scrollview to enable absolute sticky footer
text = text.replace('<ScrollView contentContainerStyle={styles.scroll}>', '<View style={{ flex: 1, backgroundColor: "#ffffff" }}>\n      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]}>')

# 3. Relocate actions row to sticky bottom
actions_section_regex = r'(<View style=\{styles\.actionsRow\}>.*?</View>)'
match = re.search(actions_section_regex, text, re.DOTALL)
if match:
    actions_block = match.group(1)
    
    # Remove from original place
    text = text.replace(actions_block, '')
    
    # Put it right after </ScrollView>
    scroll_end_tag = "      </ScrollView>"
    idx = text.find(scroll_end_tag)
    if idx != -1:
        styled_actions = f"""      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e7eb', zIndex: 100 }}>
        {actions_block}
      </View>"""
        # Insert styled actions after ScrollView ends
        text = text[:idx] + scroll_end_tag + "\n" + styled_actions + text[idx + len(scroll_end_tag):]

# 4. Clean background color on ScreenContainer
text = text.replace('<ScreenContainer bg="#f2f2f7">', '<ScreenContainer bg="#ffffff">')

# 5. Bold Timeline/Routes style
# routeLine config: make it thicker, solid black
text = text.replace("routeLine: { width: 2, height: 24, backgroundColor: '#e5e7eb', marginLeft: 4 }", "routeLine: { width: 3, height: 32, backgroundColor: '#000000', marginLeft: 3.5 }")

# routeDot config: make it a larger solid block
text = text.replace("routeDot: {\n    width: 10,\n    height: 10,\n    borderRadius: 5,\n    backgroundColor: '#000000',\n    borderWidth: 2,\n    borderColor: '#e5e7eb',\n  }", "routeDot: {\n    width: 12,\n    height: 12,\n    borderRadius: 0,\n    backgroundColor: '#000000',\n  }")

# end dot - slightly circular and larger
text = text.replace("routeDotEnd: { backgroundColor: '#000', borderColor: '#000' }", "routeDotEnd: { backgroundColor: '#000', borderRadius: 6 }")

# Map container outer wrapper fix in JSX (closing flex view we added in step 2)
# The file has:
#       </ScrollView>
#     </ScreenContainer>
# We need to change that to:
#       </ScrollView>
#       [Sticky Actions]
#       </View>   <-- NEW closing flex view
#     </ScreenContainer>
# So we just append </View> right before </ScreenContainer>

idx2 = text.rfind('</ScreenContainer>')
if idx2 != -1:
    text = text[:idx2] + '      </View>\n    ' + text[idx2:]

with open('app/(driver)/active.tsx', 'w') as f:
    f.write(text)

print("Patch applied")