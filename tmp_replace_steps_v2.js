const fs = require('fs');
const path = 'apps/web/src/app/dashboard/order/transport/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

const startTag = '<div className="flex items-center gap-1 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x relative mask-fade-edges">';
const endTag = '</div>\n\n              <div className="py-2">';

const startIndex = txt.indexOf(startTag);
const endIndex = txt.indexOf(endTag, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const newPart = `<div className="flex w-full items-center gap-1.5 px-0.5 mb-2">
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
                      className="group flex flex-1 flex-col gap-2.5 relative disabled:opacity-50 text-left outline-none"
                    >
                      <div className={\`h-1.5 w-full rounded-full transition-all duration-300 \${
                        active ? 'bg-[#D82B24]' : done ? 'bg-[#D82B24]/40' : 'bg-gray-200'
                      }\`} />
                      <span className={\`text-[11px] font-bold tracking-wider uppercase transition-colors pr-1 truncate \${
                        active ? 'text-[#D82B24]' : done ? 'text-foreground hover:text-[#D82B24]' : 'text-muted-foreground'
                      }\`}>
                         {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>`;
              
  const replaced = txt.substring(0, startIndex) + newPart + '\n\n              <div className="py-2">' + txt.substring(endIndex + endTag.length);
  fs.writeFileSync(path, replaced, 'utf8');
  console.log("Success with node replace");
} else {
  console.log("Could not find start/end marks");
}
