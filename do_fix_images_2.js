const fs = require('fs');
const file = 'apps/web/src/app/dashboard/catalog/page.tsx';
let code = fs.readFileSync(file, 'utf8');

if (code.indexOf('Mountain') === -1) {
  code = code.replace("  Zap,\n} from 'lucide-react';", "  Mountain,\n  MountainSnow,\n  Box,\n  Hexagon,\n  Droplets,\n  Sprout,\n  Recycle,\n  Road,\n  CircleFadingUp,\n  Zap,\n} from 'lucide-react';");
}

code = code.replace("{ label: string; description: string; defaultUnit: MaterialUnit; defaultName: string; image: string }", "{ label: string; description: string; defaultUnit: MaterialUnit; defaultName: string; icon: React.ElementType }");

code = code.replace(/image:\s*'[^']*',/g, 'icon: undefined,');

code = code.replace(/SAND: \{[\s\S]*?icon: undefined,/, "SAND: {\n    label: 'Smiltis',\n    description: 'Uzbēruma, celtnieku un filtrācijas smiltis',\n    defaultUnit: 'TONNE',\n    defaultName: 'Uzbēruma smiltis',\n    icon: Droplets,");
code = code.replace(/GRAVEL: \{[\s\S]*?icon: undefined,/, "GRAVEL: {\n    label: 'Grants',\n    description: 'Ceļu grants, drenāžas grants, šķembas',\n    defaultUnit: 'TONNE',\n    defaultName: 'Ceļu grants',\n    icon: Mountain,");
code = code.replace(/STONE: \{[\s\S]*?icon: undefined,/, "STONE: {\n    label: 'Akmens',\n    description: 'Drupināts akmens, bruģakmens, laukakmens',\n    defaultUnit: 'TONNE',\n    defaultName: 'Drupināts akmens',\n    icon: MountainSnow,");
code = code.replace(/CONCRETE: \{[\s\S]*?icon: undefined,/, "CONCRETE: {\n    label: 'Betons',\n    description: 'Gatavs betona maisījums, betona bloki',\n    defaultUnit: 'M3',\n    defaultName: 'Gatavs betons',\n    icon: Box,");
code = code.replace(/SOIL: \{[\s\S]*?icon: undefined,/, "SOIL: {\n    label: 'Augsne',\n    description: 'Tīrā augsne, melnzeme, dārza zeme',\n    defaultUnit: 'TONNE',\n    defaultName: 'Augsne uzbēršanai',\n    icon: Sprout,");
code = code.replace(/RECYCLED_CONCRETE: \{[\s\S]*?icon: undefined,/, "RECYCLED_CONCRETE: {\n    label: 'Recikl. Betons',\n    description: 'Sasmalcināts betons no nojaukšanas darbiem',\n    defaultUnit: 'TONNE',\n    defaultName: 'Reciklēts betons',\n    icon: Recycle,");
code = code.replace(/RECYCLED_SOIL: \{[\s\S]*?icon: undefined,/, "RECYCLED_SOIL: {\n    label: 'Recikl. Augsne',\n    description: 'Pārstrādāta augsne celtniecības vajadzībām',\n    defaultUnit: 'TONNE',\n    defaultName: 'Reciklēta augsne',\n    icon: Recycle,");
code = code.replace(/ASPHALT: \{[\s\S]*?icon: undefined,/, "ASPHALT: {\n    label: 'Asfalts',\n    description: 'Asfalts ceļiem un stāvvietām',\n    defaultUnit: 'TONNE',\n    defaultName: 'Asfalta maisījums',\n    icon: Road,");
code = code.replace(/CLAY: \{[\s\S]*?icon: undefined,/, "CLAY: {\n    label: 'Māls',\n    description: 'Māls hidroizolācijai un uzbērumiem',\n    defaultUnit: 'TONNE',\n    defaultName: 'Māls',\n    icon: CircleFadingUp,");
code = code.replace(/OTHER: \{[\s\S]*?icon: undefined,/, "OTHER: {\n    label: 'Citi',\n    description: 'Citi celtniecības pieprasījumi',\n    defaultUnit: 'TONNE',\n    defaultName: '',\n    icon: Hexagon,");

const oldBtnRegex = /<button[\s\S]*?onClick={onClick}[\s\S]*?<\/button>/;
const newBtn = `<button
      onClick={onClick}
      className="group relative flex flex-col text-left transition-transform active:scale-[0.98] w-full rounded-2xl border border-border/50 bg-card p-[1.25rem] hover:border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]"
    >
      <div className="mb-5 flex h-[56px] w-[56px] items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors group-hover:bg-slate-100 group-hover:text-black">
        <meta.icon className="h-[28px] w-[28px]" strokeWidth={1.5} />
      </div>
      
      {isRecycled && (
        <div className="absolute top-5 right-5 flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700">
          <Leaf className="size-3" strokeWidth={2.5} />
          <span>Recikl.</span>
        </div>
      )}
      
      <div className="mt-auto flex flex-col gap-1.5">
        <p className="font-semibold text-[16px] text-foreground tracking-tight transition-colors group-hover:text-black">{meta.label}</p>
        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">{meta.description}</p>
      </div>
    </button>`;

code = code.replace(oldBtnRegex, newBtn);

fs.writeFileSync(file, code);
