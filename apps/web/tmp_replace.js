const fs = require('fs');
const path = 'src/app/dashboard/order/transport/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

const regex = /<div className="flex items-center gap-1 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x relative mask-fade-edges">[\s\S]*?<\/div>[\n\s]*\}\)\}[\n\s]*<\/div>/;

const s2 = `<div className="flex w-full items-center gap-2">
                {STEPS.map((s, i) => {
                  const n = i + 1;
                  const active = step === n;
                  const done = step > n;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={!(done || active || (n === step + 1 && canAdvance()))}
                      onClick={() => {
                        if (done || (n === step + 1 && canAdvance())) setStep(n);
                      }}
                      className="group flex flex-1 flex-col gap-2 relative disabled:opacity-50 text-left outline-none"
                    >
                      <div className={\`h-1 w-full rounded-full transition-all duration-300 \${
                        active ? 'bg-[#D82B24]' : done ? 'bg-[#D82B24]/40' : 'bg-[#e5e5e5]'
                      }\`} />
                      <span className={\`text-[11px] font-bold tracking-wider uppercase transition-colors \${
                        active ? 'text-[#D82B24]' : done ? 'text-foreground' : 'text-muted-foreground'
                      }\`}>
                         {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>`;

if (regex.test(txt)) {
  txt = txt.replace(regex, s2);
  fs.writeFileSync(path, txt, 'utf8');
  console.log("Success step replacement");
} else {
  console.log("Not found step regex!");
}
