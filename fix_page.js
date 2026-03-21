const fs = require('fs');

let content = fs.readFileSync('apps/web/src/app/dashboard/documents/page.tsx', 'utf8');

// Replace everything from the return statement up to the start of the Stats row
let newJSX = `    return (
    <div className="w-full h-full pb-20 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Mani Dokumenti</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Visi jūsu rēķini, svēršanas lapas, piegādes apstiprinājumi un sertifikāti — bez papīra, vienā vietā.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDocs} disabled={fetching} className="rounded-full shadow-sm bg-background border-border/40 shrink-0">
          <RefreshCw className={\`h-4 w-4 mr-1.5 \${fetching ? 'animate-spin' : ''}\`} />
          Atjaunot
        </Button>
      </div>

      {/* ── Stats row ── */}`;

const startIndex = content.indexOf('return (\n    <div className="min-h-screen bg-gray-50">');
if (startIndex === -1) {
    console.log("Could not find start index, using fallback match");
}

const endIndex = content.indexOf('{/* ── Stats row ── */}');

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + newJSX + content.substring(endIndex + 23);
}

// remove </main>
content = content.replace('</main>', '');

// update Stats row grid and styling
content = content.replace(/<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">/, '<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">');

content = content.replace(/bg-white rounded-xl border border-gray-200 p-4/g, 'bg-muted/40 rounded-2xl border border-transparent p-5');

content = content.replace(/text-gray-900/g, 'text-foreground');
content = content.replace(/text-gray-500/g, 'text-muted-foreground');
content = content.replace(/text-blue-600/g, 'text-blue-500');
content = content.replace(/text-amber-600/g, 'text-amber-500');
content = content.replace(/bg-amber-50/g, 'bg-amber-500/10');
content = content.replace(/border-amber-200/g, 'border-amber-500/20');
content = content.replace(/text-amber-700/g, 'text-amber-500');

// Replace filters wrapper
content = content.replace(
    '<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">',
    '<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-muted/40 rounded-2xl border border-transparent p-2">'
);

// Tab pills
let tabsOld = "className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${";
tabsOld += "\n                    activeTab === tab.id";
tabsOld += "\n                      ? 'bg-primary text-primary-foreground shadow-sm'";
tabsOld += "\n                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/30 hover:text-primary'";
tabsOld += "\n                  }`}";
let tabsNew = "className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/50'}`}";

content = content.replace(
    /className=\{\`flex items-center gap-1\.5 rounded-full px-3 py-1\.5 text-xs font-medium transition-colors \$\{[^}]+\}\`/g,
    tabsNew
);


// Remaining background/text colors in badges
content = content.replace(/bg-white\/20 text-white/g, 'bg-muted text-foreground');
content = content.replace(/bg-muted text-muted-foreground/g, 'bg-background text-muted-foreground');


// Fallback search replace
content = content.replace(
    /<div className="relative sm:ml-auto w-full sm:w-64">[\s\S]*?<\/div>/,
    `<div className="relative w-full md:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Meklēt dokumentus…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground/60 shadow-sm"
            />
          </div>`
);

// Loading state
content = content.replace(
    /<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" \/>/g,
    '<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground/20 border-t-foreground" />'
);

content = content.replace(
    /className="font-medium text-gray-500"/g,
    'className="font-medium text-muted-foreground"'
);

fs.writeFileSync('apps/web/src/app/dashboard/documents/page.tsx', content);
