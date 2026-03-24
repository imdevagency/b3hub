const fs = require('fs');
const file = 'apps/web/src/app/dashboard/catalog/page.tsx';
let code = fs.readFileSync(file, 'utf8');

if (code.indexOf('Mountain') === -1) {
  code = code.replace('  Zap,
} from \'lucide-react\';', '  Mountain,
  MountainSnow,
  Box,
  Hexagon,
  Droplets,
  Sprout,
  Recycle,
  Road,
  CircleFadingUp,
  Zap,
} from \'lucide-react\';');
}

code = code.replace('{ label: string; description: string; defaultUnit: MaterialUnit; defaultName: string; image: string }', '{ label: string; description: string; defaultUnit: MaterialUnit; defaultName: string; icon: React.ElementType }');

code = code.replace(/image:\s*'[^']*',/g, 'icon: Hexagon,');
code = code.replace(/SAND: \{[\s\S]*?icon: Hexagon,/, "SAND: {
    label: 'Smiltis',
    description: 'Uzbēruma, celtnieku un filtrācijas smiltis',
    defaultUnit: 'TONNE',
    defaultName: 'Uzbēruma smiltis',
    icon: Droplets,");
code = code.replace(/GRAVEL: \{[\s\S]*?icon: Hexagon,/, "GRAVEL: {
    label: 'Grants',
    description: 'Ceļu grants, drenāžas grants, šķembas',
    defaultUnit: 'TONNE',
    defaultName: 'Ceļu grants',
    icon: Mountain,");
code = code.replace(/STONE: \{[\s\S]*?icon: Hexagon,/, "STONE: {
    label: 'Akmens',
    description: 'Drupināts akmens, bruģakmens, laukakmens',
    defaultUnit: 'TONNE',
    defaultName: 'Drupināts akmens',
    icon: MountainSnow,");
code = code.replace(/CONCRETE: \{[\s\S]*?icon: Hexagon,/, "CONCRETE: {
    label: 'Betons',
    description: 'Gatavs betona maisījums, betona bloki',
    defaultUnit: 'M3',
    defaultName: 'Gatavs betons',
    icon: Box,");
code = code.replace(/SOIL: \{[\s\S]*?icon: Hexagon,/, "SOIL: {
    label: 'Augsne',
    description: 'Tīrā augsne, melnzeme, dārza zeme',
    defaultUnit: 'TONNE',
    defaultName: 'Augsne uzbēršanai',
    icon: Sprout,");
code = code.replace(/RECYCLED_CONCRETE: \{[\s\S]*?icon: Hexagon,/, "RECYCLED_CONCRETE: {
    label: 'Recikl. Betons',
    description: 'Sasmalcināts betons no nojaukšanas darbiem',
    defaultUnit: 'TONNE',
    defaultName: 'Reciklēts betons',
    icon: Recycle,");
code = code.replace(/RECYCLED_SOIL: \{[\s\S]*?icon: Hexagon,/, "RECYCLED_SOIL: {
    label: 'Recikl. Augsne',
    description: 'Pārstrādāta augsne celtniecības vajadzībām',
    defaultUnit: 'TONNE',
    defaultName: 'Reciklēta augsne',
    icon: Recycle,");
code = code.replace(/ASPHALT: \{[\s\S]*?icon: Hexagon,/, "ASPHALT: {
    label: 'Asfalts',
    description: 'Asfalts ceļiem un stāvvietām',
    defaultUnit: 'TONNE',
    defaultName: 'Asfalta maisījums',
    icon: Road,");
code = code.replace(/CLAY: \{[\s\S]*?icon: Hexagon,/, "CLAY: {
    label: 'Māls',
    description: 'Māls hidroizolācijai un uzbērumiem',
    defaultUnit: 'TONNE',
    defaultName: 'Māls',
    icon: CircleFadingUp,");

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

