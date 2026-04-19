const fs = require('fs');

const file = '/Users/dags/Desktop/b3hub/apps/web/src/app/dashboard/orders/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const sIdx = txt.indexOf('return (', txt.indexOf('function ActiveJobTab'));
const realSIdx = txt.indexOf('{/* Delivery Success Modal */}', sIdx);
const eIdx = txt.indexOf('function CarrierHistoryView', realSIdx);

const prefix = txt.substring(0, realSIdx);
const suffix = '\n    </div>\n  );\n}\n\n' + txt.substring(eIdx);

const newRender = `{/* Delivery Success Modal */}
      {deliveredJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-background rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 text-center border">
            <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
              <CheckCircle className="size-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Piegādāts!</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Darbs lieliski pabeigts. Paldies par darbu!
              </p>
            </div>
            <div className="bg-muted/40 p-4 rounded-2xl flex justify-between items-center text-left">
               <div>
                 <p className="text-xs text-muted-foreground font-medium">Nopelnīts</p>
                 <p className="text-lg font-bold">{fmtMoney(deliveredJob.rate ?? 0)}</p>
               </div>
               <div className="text-right">
                 <p className="text-xs text-muted-foreground font-medium">Darba Nr.</p>
                 <p className="text-sm font-mono font-medium">#{deliveredJob.jobNumber}</p>
               </div>
            </div>
            <Button
              size="lg"
              className="w-full rounded-full h-12 text-base font-semibold"
              onClick={() => {
                setDeliveredJob(null);
                if (onDelivered) onDelivered();
              }}
            >
              Lieliski
            </Button>
          </div>
        </div>
      )}

      {/* Proof Modal */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-background rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowProofModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:bg-muted p-2 rounded-full"
            >
              <X className="size-5" />
            </button>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Piegādes apstiprinājums</h3>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Lūdzu ievadiet saņēmēja vārdu un piezīmes.
                </p>
              </div>
              {proofError && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 font-medium flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  {proofError}
                </div>
              )}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-muted-foreground">Saņēmējs (pēc izvēles)</label>
                  <input
                    className="w-full rounded-xl border border-input px-4 py-3 text-sm transition-colors focus:border-primary outline-none"
                    placeholder="Piem. Jānis Bērziņš"
                    value={proofRecipient}
                    onChange={(e) => setProofRecipient(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-muted-foreground">Piezīmes (pēc izvēles)</label>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-input px-4 py-3 text-sm transition-colors focus:border-primary outline-none resize-none"
                    placeholder="Piem. Atstāts pie vārtiem"
                    value={proofNotes}
                    onChange={(e) => setProofNotes(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleProofSubmit}
                  disabled={proofSubmitting}
                  size="lg"
                  className="w-full rounded-xl h-12 mt-2"
                >
                  {proofSubmitting ? (
                    <RefreshCw className="size-5 animate-spin mr-2" />
                  ) : null}
                  {proofSubmitting ? 'Sūta...' : 'Pabeigt piegādi'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main UI Map Area Layer (Uber Style) */}
      <div className="relative min-h-[750px] bg-muted/20 rounded-[2rem] overflow-hidden shadow-inner border border-border/40 pb-[240px]">
         <div className="absolute top-4 left-4 z-10 w-[calc(100%-32px)]">
           <div className="bg-background/90 backdrop-blur-md px-4 py-3.5 rounded-3xl shadow-lg border border-white/20 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase mb-0.5">#{job.jobNumber}</p>
                <h3 className="font-bold text-foreground text-[14px] flex items-center gap-1.5 leading-none">
                   {STATUS_LABEL[job.status as JobStatus] || job.status}
                </h3>
              </div>
              <button onClick={handleRefresh} disabled={refreshing} className="p-2 -mr-2 bg-muted/40 rounded-full text-muted-foreground hover:bg-muted transition-colors">
                <RefreshCw className={\`size-4 \${refreshing ? 'animate-spin' : ''}\`} />
              </button>
           </div>
         </div>
         {job.pickupLat && job.pickupLng && job.status !== 'DELIVERED' ? (
           <div className="w-full h-full object-cover pb-[120px]">
             <StaticMapEmbed 
                pickupLat={job.pickupLat} 
                pickupLng={job.pickupLng} 
                pickupLabel={job.pickupAddress || 'Iekraušana'} 
                deliveryLat={job.deliveryLat!} 
                deliveryLng={job.deliveryLng!} 
                deliveryLabel={job.deliveryAddress || 'Piegāde'} 
             />
           </div>
         ) : (
           <div className="w-full h-full bg-muted/30 flex items-center justify-center pb-[120px]">
             <Map className="size-10 text-muted-foreground/30" />
           </div>
         )}
      </div>

      {/* Floater Bottom Sheet (Job Details & Action) */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex flex-col pointer-events-none mt-[-240px]">
        {/* Top gradient to blend with map */}
        <div className="h-16 bg-gradient-to-t from-background via-background/90 to-transparent w-full" />
        
        <div className="bg-background rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.1)] border-t border-border/40 p-6 sm:p-8 pt-8 w-full pointer-events-auto pb-safe">
            <div className="flex justify-between items-start mb-8">
               <div className="flex items-start gap-4">
                  {['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP'].includes(job.status) ? (
                     <div className="bg-blue-100 text-blue-700 p-3.5 rounded-full flex-shrink-0 mt-1 shadow-sm"><MapPin className="size-6" /></div>
                  ) : (
                     <div className="bg-emerald-100 text-emerald-700 p-3.5 rounded-full flex-shrink-0 mt-1 shadow-sm"><MapPin className="size-6" /></div>
                  )}
                  <div>
                    <h2 className="text-[12px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5 mb-1.5">
                      {['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP'].includes(job.status) ? 'Iekraušana' : 'Piegāde'}
                    </h2>
                    <p className="text-[24px] font-black text-foreground leading-[1.1] pr-4 tracking-tight">
                      {['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP'].includes(job.status) ? (job.pickupAddress || job.pickupCity) : (job.deliveryAddress || job.deliveryCity)}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <span className="font-semibold text-foreground bg-muted/50 px-2.5 py-1 rounded-md">
                        {job.cargoType} • {job.cargoWeight ? (job.cargoWeight/1000).toFixed(2)+' t' : ''}
                      </span>
                      <span className="text-[18px] font-black tracking-tight text-primary ml-auto">
                        {fmtMoney(job.rate ?? 0)}
                      </span>
                    </div>
                  </div>
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

            {job.slaStatus !== 'ON_TIME' && job.status !== 'DELIVERED' && (
               <div className="mb-5 bg-red-50 text-red-700 text-sm font-bold px-4 py-3.5 rounded-2xl flex items-center gap-2 border border-red-100">
                 <AlertTriangle className="size-4" />
                 {formatSlaStage(job.slaStatusStage)}
               </div>
            )}

            {NEXT_STATUS[job.status as JobStatus] && (
               <Button
                 size="lg"
                 className="w-full rounded-2xl h-[68px] text-[18px] font-bold shadow-2xl shadow-primary/25 transition-all active:scale-95 flex items-center justify-center gap-2.5 bg-foreground text-background hover:bg-foreground/90"
                 disabled={advancing || (job.status === 'AT_DELIVERY' && deliveryBlockers.length > 0)}
                 onClick={handleAdvance}
               >
                 {advancing ? <RefreshCw className="size-5 animate-spin" /> : 
                    job.status === 'AT_DELIVERY' ? <ClipboardCheck className="size-6" /> :
                    <Truck className="size-6" />
                 }
                 {NEXT_ACTION_LABEL[job.status as JobStatus]}
               </Button>
            )}

            <div className="grid grid-cols-2 gap-3 mt-5">
               <button onClick={() => alert('Detaļas dialogs drīzumā')} className="flex items-center justify-center gap-2 rounded-2xl bg-muted/30 hover:bg-muted/60 py-4 text-[14px] font-bold text-foreground transition-colors border-none">
                 <Package className="size-4 text-muted-foreground" />
                 Sīkāk
               </button>
               <button onClick={() => {
                  const el = document.getElementById('report-exception');
                  if (el) {
                    el.classList.remove('hidden');
                    el.scrollIntoView({behavior: 'smooth'})
                  }
               }} className="flex items-center justify-center gap-2 rounded-2xl bg-red-50/50 hover:bg-red-50 text-red-600 font-bold py-4 text-[14px] transition-colors">
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
`;
fs.writeFileSync(file, prefix + newRender + suffix);
console.log('Successfully completed!');
