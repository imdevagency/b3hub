const fs = require('fs');
const file = 'components/wizard/InlineAddressStep.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(
  `      {/* Search panel */}
      <View style={s.searchPanel}>
        {/* Input */}
        <View style={[s.searchBox, showSugs && s.searchBoxFocused]}>`,
  `      {/* Search panel */}
      <View style={s.searchPanel}>
        {/* Optional reference address timeline */}
        {contextAddress && (
          <View style={s.timelineWrap}>
            <View style={s.timelineRow}>
              <View style={s.timelineDot} />
              <Text style={s.timelineText} numberOfLines={1}>
                {contextAddress.address}
              </Text>
            </View>
            <View style={s.timelineLine} />
          </View>
        )}

        {/* Input */}
        <View style={[s.searchBox, showSugs && s.searchBoxFocused]}>`
);

fs.writeFileSync(file, txt);
