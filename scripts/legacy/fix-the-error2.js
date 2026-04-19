const fs = require('fs');

let text = fs.readFileSync('apps/mobile/app/(buyer)/transport-job/[id].tsx', 'utf8');

if (!text.includes('{isActive ? (')) {
    const startToken = '{/* ── MAP SECTION ── */}';
    const endToken = '      {/* ── CONTENT SECTION ── */}';
    const startIdx = text.indexOf(startToken);
    const endIdx = text.indexOf(endToken);

    if (startIdx !== -1 && endIdx !== -1) {
        const mapCode = text.slice(startIdx, endIdx);
        // We want to replace it.
        const replacement = `{isActive ? (\n        <View>\n    ${mapCode}\n        </View>\n      ) : (\n        <ScreenHeader \n          title={job?.jobNumber || 'Pasūtījums'}\n          rightAction={st && <StatusPill label={st.label} bg={st.bg} color={st.color} />}\n        />\n      )}\n\n`;
        text = text.slice(0, startIdx) + replacement + text.slice(endIdx);
    }
}

fs.writeFileSync('apps/mobile/app/(buyer)/transport-job/[id].tsx', text);
