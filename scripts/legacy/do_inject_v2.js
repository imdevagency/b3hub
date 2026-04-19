const fs = require('fs');
const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Ensure Truck and Navigation are imported properly. Just append them to an existing lucide import, avoiding duplicates.
const lucideImports = ['Truck', 'Navigation', 'AlertTriangle', 'MapPin'];
for(let imp of lucideImports) {
    if(!txt.includes(`import { ${imp}`)) {
        if(!txt.includes(`${imp} `) && !txt.includes(` ${imp},`)) {
            // Find lucide-react import
            const match = txt.match(/import \{(.*?)\} from 'lucide-react';/);
            if(match) {
                if(!match[1].includes(imp)) {
                    txt = txt.replace(match[0], `import {${match[1]}, ${imp}} from 'lucide-react';`);
                }
            } else {
                txt = txt.replace(
                    "import { PageSpinner } from '@/components/ui/page-spinner';",
                    "import { PageSpinner } from '@/components/ui/page-spinner';\nimport { " + imp + " } from 'lucide-react';"
                );
            }
        }
    }
}

// Ensure EmptyState
if (!txt.includes("import { EmptyState }")) {
  txt = txt.replace(
    "import { PageSpinner } from '@/components/ui/page-spinner';",
    "import { PageSpinner } from '@/components/ui/page-spinner';\nimport { EmptyState } from '@/components/ui/empty-state';"
  );
}

// We need to replace the `ActiveJobTab` return block AGAIN, to use the correct fields
const startStr = `  if (loading) {
    return <PageSpinner className="py-32" />;
  }`;

const newReturn = `  if (loading) {
    return <PageSpinner className="py-32" />;
  }

  if (!job) {
    return (
      <EmptyState
        icon={Truck}
        title="Nav aktīva transporta darba"
        description="Jums pašlaik nav neviena aktīva vai uzsākta transporta darba."
      />
    );
  }

  const formatDocCode = (docType: string) => {
    switch (docType) {
      case 'WAYBILL': return 'Pavadzīme';
      case 'EIR': return 'EIR';
      case 'RECYCLING_CERT': return 'Pārstrādes akts';
      default: return docType;
    }
  };

  const getActionLabel = () => {
    if (job.status === 'ASSIGNED') return 'Sākt Ceļu Uz Iekraušanu';
    if (job.status === 'EN_ROUTE_PICKUP') return 'Esmu Iekraušanā';
    if (job.status === 'AT_PICKUP') return 'Krava Piekrauta';
    if (job.status === 'EN_ROUTE_DELIVERY') return 'Esmu Objektā';
    if (job.status === 'AT_DELIVERY') return 'Pabeigt Piegādi';
    return 'Turpināt';
  };

  const mapsUrl = (lat: number, lng: number) => 
    lat && lng ? \`https://www.google.com/maps/dir/?api=1&destination=\${lat},\${lng}\` : '#';

  return (
    <div className="max-w-xl mx-auto pb-32">
      {/* Map Header / Main Status */}
      <div className="relative rounded-3xl overflow-hidden bg-muted aspect-video mb-4 shadow-sm border border-border/50 group">
        <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=56.9496,24.1052&zoom=11&size=600x300&style=feature:all|element:labels|visibility:off&style=feature:water|color:0xe0e6ed&style=feature:landscape|color:0xf5f7fa&key=YOUR_API_KEY_HERE')] bg-cover bg-center opacity-75 grayscale group-hover:opacity-100 transition-opacity" />
        
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-background/90 to-transparent p-6 pb-12">
            <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center gap-2 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm text-sm font-bold border border-border/50">
                    <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
                    {JOB_STATUS[(job.status as any)] || job.status}
                </div>
                <div className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest bg-background/50 px-3 py-1.5 rounded-full backdrop-blur-md">
                    {job.jobNumber}
                </div>
            </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-6 pt-16">
            <h1 className="text-3xl font-black tracking-tight drop-shadow-sm mb-1">
                {job.cargoType || 'Materiāls'}
            </h1>
            <div className="flex items-center gap-3 text-[15px] font-semibold text-muted-foreground">
                <span className="text-foreground">{job.cargoWeight || 0} t</span>
                <span className="size-1.5 rounded-full bg-border" />
                <span>Nav nosvērts</span>
            </div>
        </div>
      </div>

      {/* Main Action Button */}
      <div className="sticky top-4 z-40 mb-6 drop-shadow-2xl">
         <Button 
            onClick={handleAdvance} 
            disabled={advancing} 
            className="w-full h-16 rounded-[2rem] text-lg font-black tracking-wide shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
         >
            {advancing ? <PageSpinner className="py-0 h-6 w-6" /> : getActionLabel()}
         </Button>
      </div>

      {/* Route Cards */}
      <div className="space-y-4 px-1">
        {/* Pickup Card */}
        <div className="bg-background rounded-3xl p-6 shadow-sm border border-border/50 relative overflow-hidden">
            <div className="flex items-start justify-between gap-4">
               <div>
                 <div className="flex items-center gap-2 text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                   <div className="size-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">A</div>
                   Iekraušana
                 </div>
                 <h3 className="text-xl font-bold mb-1">{job.pickupCity || job.pickupAddress || 'Iekraušanas vieta'}</h3>
                 <p className="text-[15px] text-muted-foreground font-medium flex items-start gap-1">
                   <MapPin className="size-4 mt-0.5 flex-shrink-0" />
                   {job.pickupAddress || 'Nav adreses'}
                 </p>
               </div>
               <a 
                 href={mapsUrl(job.pickupLat || 0, job.pickupLng || 0)} 
                 target="_blank" 
                 rel="noreferrer"
                 className="flex-shrink-0 bg-secondary hover:bg-secondary/80 p-4 rounded-full transition-all shadow-sm active:scale-95"
               >
                 <Navigation className="size-6" />
               </a>
            </div>
        </div>

        {/* Dropoff Card */}
        <div className="bg-background rounded-3xl p-6 shadow-sm border border-border/50 relative overflow-hidden">
            <div className="flex items-start justify-between gap-4">
               <div>
                 <div className="flex items-center gap-2 text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                   <div className="size-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">B</div>
                   Izraušana
                 </div>
                 <h3 className="text-xl font-bold mb-1">{job.deliveryCity || job.deliveryAddress || 'Piegādes objekts'}</h3>
                 <p className="text-[15px] text-muted-foreground font-medium flex items-start gap-1">
                   <MapPin className="size-4 mt-0.5 flex-shrink-0" />
                   {job.deliveryAddress || 'Nav adreses'}
                 </p>
               </div>
               <a 
                 href={mapsUrl(job.deliveryLat || 0, job.deliveryLng || 0)} 
                 target="_blank" 
                 rel="noreferrer"
                 className="flex-shrink-0 bg-secondary hover:bg-secondary/80 p-4 rounded-full transition-all shadow-sm active:scale-95"
               >
                 <Navigation className="size-6" />
               </a>
            </div>

            <div className="mt-6 pt-6 border-t border-border flex gap-3">
               <button onClick={() => {
                  const el = document.getElementById('report-exception');
                  if (el) {
                      el.classList.toggle('hidden');
                  }
               }} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-secondary/50 hover:bg-secondary font-bold py-4 text-[14px] transition-colors">
                 <AlertTriangle className="size-4" />
                 Problēma
               </button>
            </div>
            
            <div id="report-exception" className="hidden mt-8 border-t border-border/50 pt-8 transition-all">
               <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-5 flex items-center gap-2">Pievienot Izņēmumu</h4>
               <div className="flex flex-col gap-4">
                 <select 
                   value={exceptionType} 
                   onChange={(e) => setExceptionType(e.target.value as any)}
                   className="w-full rounded-2xl border border-input px-5 py-4 text-[15px] bg-background font-semibold outline-none focus:border-primary shadow-sm appearance-none"
                 >
                   {EXCEPTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                 </select>
                 <textarea 
                   placeholder="Piezīmes rīkotājam..." 
                   value={exceptionNotes}
                   onChange={e => setExceptionNotes(e.target.value)}
                   rows={3}
                   className="w-full flex-1 rounded-2xl border border-input px-5 py-4 text-[15px] font-medium bg-background resize-none outline-none focus:border-primary shadow-sm min-h-[100px]"
                 />
                 <Button onClick={handleReportException} disabled={reportingException || !exceptionNotes.trim()} size="lg" variant="outline" className="w-full rounded-2xl font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-14">
                    Nosūtīt Ziņojumu
                 </Button>
               </div>
            </div>
        </div>
      </div>

    </div>
  );
}`;

// Find start and end bounds
const sIdx = txt.indexOf(startStr);
const nextFuncIdx = txt.indexOf('function ActiveSkipTab(', sIdx); // Or end of function
let eIdx = -1;

if (nextFuncIdx !== -1) {
  // Find the exact `  ); \n}` of ActiveJobTab before nextFuncIdx
  eIdx = txt.lastIndexOf('  );\n}', nextFuncIdx) + '  );\n}'.length;
} else {
    // If not found ActiveSkipTab, find the last  `  );\n}` in the file
    eIdx = txt.lastIndexOf('  );\n}') + '  );\n}'.length;
}

if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
  txt = txt.substring(0, sIdx) + newReturn + '\n' + txt.substring(eIdx);
  fs.writeFileSync(file, txt);
  console.log("Successfully injected new UI V2!");
} else {
  console.log("Could not find bounds to replace.");
}
