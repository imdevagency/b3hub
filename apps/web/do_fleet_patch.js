const fs = require('fs');
const file = 'src/app/dashboard/fleet/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update stats array background classes
code = code.replace(/bg: 'bg-background border-border shadow-sm'/g, "bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'");
code = code.replace(/bg: 'bg-background border-foreground text-foreground shadow-sm'/g, "bg: 'bg-primary/5 border-primary/20 text-primary shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'");

// Update stats mapping roundness
code = code.replace(/className=\{\`rounded-xl border p-4 \$\{s\.bg\}\`\}/g, "className={`rounded-[2rem] border p-5 sm:p-6 transition-all duration-300 hover:shadow-lg ${s.bg}`}");

// View mode toggles
code = code.replace(/<div className="flex rounded-lg border border-input overflow-hidden">/g, '<div className="flex rounded-[1.25rem] bg-muted/50 p-1">');
code = code.replace(/className=\{\`flex items-center gap-1\.5 px-3 py-1\.5 text-xs font-medium transition-colors \$\{\s*viewMode === 'list'\s*\?\s*'bg-primary text-primary-foreground'\s*:\s*'bg-background text-muted-foreground hover:bg-muted'\s*\}\`\}/g, 
"className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-2xl transition-all duration-200 ${viewMode === 'list' ? 'bg-white dark:bg-zinc-900 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}");
code = code.replace(/className=\{\`flex items-center gap-1\.5 px-3 py-1\.5 text-xs font-medium transition-colors border-l border-input \$\{\s*viewMode === 'map'\s*\?\s*'bg-primary text-primary-foreground'\s*:\s*'bg-background text-muted-foreground hover:bg-muted'\s*\}\`\}/g, 
"className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-2xl transition-all duration-200 ml-1 ${viewMode === 'map' ? 'bg-white dark:bg-zinc-900 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}");

// Filters
code = code.replace(/className=\{\`rounded-full px-3 py-1 text-xs font-semibold transition-colors \$\{\s*statusFilter === f\.key\s*\?\s*'bg-primary text-primary-foreground'\s*:\s*'bg-muted text-muted-foreground hover:bg-muted\/70'\s*\}\`\}/g,
"className={`rounded-2xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${statusFilter === f.key ? 'bg-foreground text-background shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}");
code = code.replace(/className="ml-auto h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring w-64"/g,
"className=\"ml-0 sm:ml-auto h-11 rounded-[1.5rem] border-0 bg-white dark:bg-zinc-950 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] px-5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-72 transition-shadow\"");

// Table container (just replace the first matching opening)
code = code.replace(/<div className="overflow-auto rounded-xl border border-border\/50">/g, 
  '<div className="overflow-hidden rounded-[2.5rem] bg-white dark:bg-zinc-950 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-border/40 pb-2">\\n            <div className="overflow-auto px-2">');

// We have to close the extra div for overflow-auto px-2
const tableEndIdx = code.indexOf('          </div>\n        )');
if (tableEndIdx !== -1) {
    code = code.substring(0, tableEndIdx) + '            </div>\n' + code.substring(tableEndIdx);
}

// Table head
code = code.replace(/<thead className="bg-muted\/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">/g, 
  '<thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 border-b-2 border-border/30">');

// Table row hover padding/transitions
code = code.replace(/<tr key=\{job\.id\} className="bg-background hover:bg-muted\/20 transition-colors">/g, 
  '<tr key={job.id} className="group hover:bg-muted/30 transition-colors duration-300">');

const innerTd = `
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-muted-foreground/80 group-hover:text-foreground transition-colors">
                      {job.jobNumber}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-medium">{JOB_TYPE_LV[job.jobType] ?? job.jobType}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <span>{job.pickupCity}</span>
                        <span className="text-muted-foreground/50">→</span>
                        <span>{job.deliveryCity}</span>
                      </div>
                      {job.distanceKm && (
                        <p className="text-xs text-muted-foreground/70 mt-1 font-medium">{job.distanceKm} km</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-sm">{job.cargoType}</p>
                      {job.cargoWeight && (
                        <p className="text-xs text-muted-foreground font-medium">{job.cargoWeight} t</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {job.driver ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                              <User className="h-3 w-3 text-foreground/70" />
                            </span>
                            <span className="font-semibold text-sm">
                              {job.driver.firstName} {job.driver.lastName}
                            </span>
                          </div>
                          {job.vehicle && (
                            <p className="text-xs text-muted-foreground/80 mt-1 ml-8 font-medium">
                              {VEHICLE_LV[job.vehicle.vehicleType] ?? job.vehicle.vehicleType}
                              <span className="mx-1.5 opacity-50">·</span>
                              <span className="font-mono">{job.vehicle.licensePlate}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => router.push('/dashboard/jobs')}
                          className="inline-flex items-center text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                        >
                          + Piešķirt šoferi
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-muted-foreground/80">
                      {formatDate(job.pickupDate)}
                      {job.pickupWindow && <p className="text-muted-foreground mt-0.5">{job.pickupWindow}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={job.status} />
                    </td>
`;

code = code.replace(/<td className="px-4 py-3 font-mono text-xs font-semibold.*?<StatusBadge status=\{job\.status\} \/>.*?<\/td>/s, innerTd.trim());
code = code.replace(/<th className="px-4 py-3 text-left">/g, '<th className="px-4 py-4 text-left">');

// Fix border radius on status dots config
code = code.replace(/bg: 'bg-muted\/30 border-transparent'/g, "bg: 'bg-muted/40 border-transparent'");
code = code.replace(/bg: 'bg-background border-border shadow-sm'/g, "bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-sm'");

// Buttons styling
code = code.replace(/<Button\s+variant="outline"\s+size="sm"/g, '<Button variant="outline" size="sm" className="rounded-xl border-border/60 hover:bg-muted/50"');
code = code.replace(/<Button size="sm" onClick/g, '<Button size="sm" className="rounded-xl shadow-md" onClick');

fs.writeFileSync(file, code);
console.log('done running script');
