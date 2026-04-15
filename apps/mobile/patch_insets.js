const fs = require('fs');
const path = 'app/(buyer)/catalog.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldStr = `<View style={s.uberHeader}>
        <Text style={s.uberTitle}>Katalogs</Text>
      </View>`;

const newStr = `<View style={[s.uberHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={s.uberTitle}>Katalogs</Text>
      </View>`;

if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Success")
} else {
    console.log("Not found")
}
