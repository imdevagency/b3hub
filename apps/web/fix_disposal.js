const fs = require('fs');

try {
let code = fs.readFileSync('src/app/dashboard/order/disposal/page.tsx', 'utf8');

// find the main wrapper
let startIdx = code.indexOf('<div className="w-full h-[calc(100vh-100px)]');
if (startIdx === -1) {
    console.log("Could not find start idx");
    process.exit(1);
}

let updated = code.substring(0, startIdx);

updated += `<div className="h-[calc(100vh-100px)] w-full bg-background rounded-2xl overflow-hidden shadow-lg border flex flex-col-reverse lg:flex-row">
      {/* LEFT: Wizard Card */}
      <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col bg-background z-10 relative border-t lg:border-t-0 lg:border-r">
        {/* Header */}
        <div className="p-5 border-b bg-card space-y-3">
          <Link href="/dashboard/order" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Atpakaļ
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Būvgružu Izvešana</h1>
            <p className="text-sm text-muted-foreground mt-1">Pasūtiet konteineru vai tehniku būvgružu izvešanai</p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          <div className="space-y-6">
`;

// Now add the steps code which was after the Right / bottom: wizard card tag
let innerContentStart = code.indexOf('{/* Step indicators */}');
let innerContentEnd = code.indexOf('          <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">');

updated += code.substring(innerContentStart, innerContentEnd);

// Instead of card add just a div 
updated += `          <div className="p-0">\n`;

let cardContentStart = code.indexOf('            <CardContent className="p-6">');
// strip away CardContent prefix
let actualContentStart = cardContentStart + '            <CardContent className="p-6">'.length;

// Find end of CardContent
let actualContentEnd = code.indexOf('            </CardContent>');

updated += code.substring(actualContentStart, actualContentEnd);

updated += `          </div>
        </div>
      </div>
      
       {/* RIGHT: Map map */}
      <div className="relative w-full h-[300px] lg:h-auto lg:flex-1 bg-muted/30">
        <GoogleMapContainer />
        {/* Overlays on map */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
           <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="truncate max-w-[200px]">{address || 'Nav norādīta adrese'}</span>
          </div>
          <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-600" />
             {date ? format(date, 'd. MMMM', { locale: lv }) : 'Nav norādīts datums'}
          </div>
        </div>
      </div>
    </div>`;

// add footer code
let returnEnd = code.indexOf('  );');
updated += code.substring(returnEnd);

fs.writeFileSync('src/app/dashboard/order/disposal/page.tsx', updated);
console.log("Success");
} catch (e) {
  console.log(e);
}
