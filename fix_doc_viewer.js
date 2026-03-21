const fs = require('fs');

let content = fs.readFileSync("apps/web/src/components/documents/DocumentViewer.tsx", "utf8");

content = content.replace(
    'className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"',
    'className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"'
);

content = content.replace(
    'className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"',
    'className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-background rounded-[2rem] shadow-2xl overflow-hidden border border-border/40"'
);

// Header background
content = content.replace(
    'className="flex items-start justify-between px-6 py-4 border-b bg-gray-50"',
    'className="flex items-start justify-between px-6 py-5 border-b border-border/40 bg-muted/40"'
);

content = content.replace(/text-gray-900/g, 'text-foreground');
content = content.replace(/text-gray-500/g, 'text-muted-foreground');
content = content.replace(/text-gray-400/g, 'text-muted-foreground/80');
content = content.replace(/text-gray-600/g, 'text-muted-foreground');
content = content.replace(/text-gray-700/g, 'text-foreground');

// Buttons outline
content = content.replace(
    /className="text-gray-600 border-gray-200 hover:text-red-600 hover:border-red-300"/g,
    'className="rounded-xl border-border/40 hover:text-primary hover:border-primary shadow-sm bg-background hover:bg-background"'
);
content = content.replace(
    /className="ml-2 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"/g,
    'className="ml-2 rounded-full p-2 text-muted-foreground/80 hover:text-foreground hover:bg-muted transition-colors"'
);

// Body bg
content = content.replace(
    'className="flex-1 overflow-auto bg-gray-100 min-h-100"',
    'className="flex-1 overflow-auto bg-muted/20 min-h-100"'
);

// Footer bg
content = content.replace(
    'className="px-6 py-3 border-t bg-gray-50"',
    'className="px-6 py-4 border-t border-border/40 bg-muted/40"'
);


fs.writeFileSync("apps/web/src/components/documents/DocumentViewer.tsx", content);
