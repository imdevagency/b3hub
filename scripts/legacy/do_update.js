const fs = require('fs');

const FILE_PATH = 'src/app/dashboard/notifications/page.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const newNotifRow = `function NotifRow({ n, onMarkRead }: { n: AppNotification; onMarkRead: (id: string) => void }) {
  const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted' };
  const Icon = meta.icon;

  return (
    <div
      className={\`group relative flex items-start gap-4 p-4 sm:p-5 rounded-[2rem] transition-all duration-200 border \${
        n.isRead
          ? 'bg-muted/10 border-transparent hover:bg-muted/30'
          : 'bg-white dark:bg-zinc-950 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border-border/40'
      }\`}
    >
      <div
        className={\`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl \${n.isRead ? 'opacity-60 saturate-50' : ''} \${meta.bg}\`}
      >
        <Icon className={\`h-5 w-5 \${meta.color}\`} />
      </div>
      
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 justify-between">
          <p
            className={\`text-[15px] leading-tight \${
              n.isRead ? 'font-medium text-foreground/70' : 'font-semibold text-foreground'
            }\`}
          >
            {n.title}
            {!n.isRead && (
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            )}
          </p>
          <span className="text-xs font-medium text-muted-foreground shrink-0 bg-muted/40 px-2 py-0.5 rounded-full whitespace-nowrap">
            {fmtRelative(n.createdAt)}
          </span>
        </div>
        
        <p className={\`mt-1.5 text-sm leading-relaxed \${
          n.isRead ? 'text-muted-foreground/70' : 'text-muted-foreground'
        }\`}>
          {n.message}
        </p>

        {!n.isRead && (
          <div className="mt-4 flex">
            <button
              onClick={() => onMarkRead(n.id)}
              className="inline-flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-200"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Atzīmēt kā lasītu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}`;

const newGroupSection = `function GroupSection({
  title,
  items,
  onMarkRead,
}: {
  title: string;
  items: AppNotification[];
  onMarkRead: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-4 ml-1 md:ml-4 text-xs font-bold tracking-wider uppercase text-muted-foreground/60">
        {title}
      </h3>
      <div className="space-y-3">
        {items.map((n) => (
          <NotifRow key={n.id} n={n} onMarkRead={onMarkRead} />
        ))}
      </div>
    </div>
  );
}`;

content = content.replace(/function NotifRow[\s\S]+?(?=function GroupSection)/, newNotifRow + '\n\n');
content = content.replace(/function GroupSection[\s\S]+?(?=\/\/ ─── Page)/, newGroupSection + '\n\n');

content = content.replace(/<div className="max-w-2xl space-y-6">/, '<div className="space-y-8 pb-12">');
content = content.replace(/<div className="max-w-3xl mx-auto space-y-8 pb-12">/, '<div className="space-y-8 pb-12">');

fs.writeFileSync(FILE_PATH, content);
console.log('Done!');