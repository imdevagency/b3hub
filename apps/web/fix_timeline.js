const fs = require('fs');
let c = fs.readFileSync('src/app/dashboard/orders/page.tsx', 'utf8');

c = c.replace(
  /className="absolute -left-6 top-1.5 size-2 rounded-full border-2 border-emerald-500 bg-white ring-4 ring-white shadow-sm"/g,
  'className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm"'
);

c = c.replace(
  /className="bg-background w-full max-w-md rounded-3xl shadow-xl border overflow-hidden"/g,
  'className="bg-background w-full max-w-md rounded-[2rem] shadow-2xl border-0 ring-1 ring-black/5 overflow-hidden"'
);

c = c.replace(
  /className="rounded-xl border border-border bg-background p-4 space-y-3 shadow-sm"/g,
  'className="rounded-2xl bg-muted/40 p-5 space-y-4"'
);

fs.writeFileSync('src/app/dashboard/orders/page.tsx', c);
