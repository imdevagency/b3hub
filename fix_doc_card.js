const fs = require('fs');

let content = fs.readFileSync("apps/web/src/components/documents/DocumentCard.tsx", "utf8");

content = content.replace(
    '<div className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-gray-300">',
    '<div className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-3xl border border-transparent bg-muted/40 p-4 transition-all hover:bg-muted/60 relative">'
);

content = content.replace(
    '<div className="flex-1 min-w-0">',
    '<div className="flex-1 min-w-0 pr-4 sm:pr-0">'
);

content = content.replace(/text-gray-900/g, 'text-foreground');
content = content.replace(/bg-gray-100/g, 'bg-muted');
content = content.replace(/text-gray-600/g, 'text-muted-foreground');
content = content.replace(/text-gray-500/g, 'text-foreground/80');
content = content.replace(/text-gray-400/g, 'text-muted-foreground/80');
content = content.replace(/text-gray-700/g, 'text-foreground');
content = content.replace(/border-gray-200/g, 'border-border/40');

content = content.replace(
    '<div className="shrink-0 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">',
    '<div className="absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto shrink-0 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">'
);

content = content.replace(
    /className="text-xs h-7 px-2 border-gray-200 hover:text-red-600 hover:border-red-300"/g,
    'className="text-xs h-8 px-3 rounded-full border-border/40 hover:text-primary hover:border-primary border hover:bg-background bg-background shadow-sm"'
);

fs.writeFileSync("apps/web/src/components/documents/DocumentCard.tsx", content);
