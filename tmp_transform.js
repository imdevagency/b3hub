const fs = require('fs');
const filepath = 'apps/web/src/app/dashboard/quote-requests/open/page.tsx';
let code = fs.readFileSync(filepath, 'utf8');

const sheetImports = "import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';\nimport { Input } from '@/components/ui/input';\nimport { Textarea } from '@/components/ui/textarea';\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';\n";

if (!code.includes('@/components/ui/sheet')) {
  code = code.replace("import { Badge } from '@/components/ui/badge';", sheetImports + "import { Badge } from '@/components/ui/badge';");
}
code = code.replace("import { PageHeader } from '@/components/ui/page-header';\n", "");

const oldRespondStart = code.indexOf('function RespondPanel(');
const oldRespondEnd = code.indexOf('// ── Request card', oldRespondStart);

const respondPanelRewrite = `function RespondPanel({ request, token, onClose, onResponded }: RespondPanelProps) {
  const [form, setForm] = useState<CreateQuoteResponseInput>({
    pricePerUnit: 0,
    unit: request.unit,
    etaDays: 1,
    notes: '',
    validUntil: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setParams = (k: keyof CreateQuoteResponseInput, v: CreateQuoteResponseInput[typeof k]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pricePerUnit || form.pricePerUnit <= 0) {
      setError('Ievadiet derīgu cenu');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateQuoteResponseInput = {
        pricePerUnit: form.pricePerUnit,
        unit: form.unit,
        etaDays: form.etaDays,
      };
      if (form.notes?.trim()) payload.notes = form.notes;
      if (form.validUntil?.trim()) payload.validUntil = form.validUntil;
      const updated = await respondToQuoteRequest(request.id, payload, token);
      onResponded(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kļūda nosūtot piedāvājumu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col h-full right-0 w-full sm:max-w-md border-l shadow-2xl p-0">
        <div className="flex-1 overflow-y-auto">
          <SheetHeader className="px-6 py-6 border-b">
            <SheetTitle>Sniegt Piedāvājumu</SheetTitle>
            <SheetDescription>
              {request.requestNumber} · {request.materialName}
            </SheetDescription>
          </SheetHeader>

          {/* Request summary */}
          <div className="px-6 py-4 bg-muted/20 text-xs text-muted-foreground space-y-2 border-b">
            <p>
              <span className="font-semibold text-foreground">Pieprasīts:</span> {request.quantity} {UNIT_LV[request.unit]} {request.materialName}
            </p>
            <p>
              <span className="font-semibold text-foreground">Piegāde:</span> {request.deliveryAddress}, {request.deliveryCity}
            </p>
            {request.notes && (
              <p>
                <span className="font-semibold text-foreground">Piezīmes:</span> {request.notes}
              </p>
            )}
          </div>

          {/* Form fields */}
          <form id="respond-form" onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cena par vienību (€) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pricePerUnit || ''}
                  onChange={(e) => setParams('pricePerUnit', parseFloat(e.target.value))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="w-1/3 space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mērvienība</label>
                <Select value={form.unit} onValueChange={(v) => setParams('unit', v as MaterialUnit)}>
                  <SelectTrigger className="h-11 bg-muted/40 border-transparent transition-all focus:bg-background focus:ring-1 focus:ring-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {UNIT_LV[u]} ({u})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Piegādes laiks (dienas) *</label>
              <Input
                type="number"
                min="1"
                max="365"
                value={form.etaDays || ''}
                onChange={(e) => setParams('etaDays', parseInt(e.target.value, 10))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Derīgums (neobligāts)</label>
              <Input
                type="date"
                value={form.validUntil || ''}
                onChange={(e) => setParams('validUntil', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Piezīmes</label>
              <Textarea
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setParams('notes', e.target.value)}
                placeholder="Pieejamība, minimālais pasūtījums u.c."
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t shrink-0 flex justify-between items-center bg-card">
          {error ? <p className="text-sm text-red-600 font-medium truncate pr-4">{error}</p> : <div/>}
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
              Atcelt
            </Button>
            <Button type="submit" form="respond-form" disabled={saving}>
              {saving ? 'Sūta...' : 'Piedāvāt'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

`;

if (oldRespondStart > -1 && oldRespondEnd > -1) {
  code = code.substring(0, oldRespondStart) + respondPanelRewrite + code.substring(oldRespondEnd);
}

code = code.replace(/<Card className="border-border\/60 bg-card py-0 shadow-none transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-sm">/g, 
  `<Card className="border-transparent bg-muted/40 py-0 shadow-none hover:bg-muted/60 transition-colors">`);

code = code.replace(/<Card className="border-border\/60 py-0 shadow-none">/g,
  `<Card className="border-transparent bg-muted/40 py-0 shadow-none">`);

const wrapperRegex = /<div className="space-y-6 max-w-5xl">\s*\{\/\* Header \*\/\}\s*<PageHeader[\s\S]*?\/>/;
const newHeader = `<div className="w-full h-full pb-20 space-y-10">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Atvērtie Pieprasījumi</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl">Iesniedziet cenu piedāvājumus reāllaikā un saņemiet pasūtījumus</p>
        </div>
        <Button variant="default" className="w-full sm:w-auto" onClick={load} disabled={loading}>
          <RefreshCw className={\`h-4 w-4 mr-2 \${loading ? 'animate-spin' : ''}\`} />
          Atjaunot sarakstu
        </Button>
      </div>`;

if (wrapperRegex.test(code)) {
  code = code.replace(wrapperRegex, newHeader);
} else {
  // fallback if already modified
  const fallbackRegex = /<div className="space-y-6 max-w-5xl">/;
  if (fallbackRegex.test(code)) {
    code = code.replace(fallbackRegex, `<div className="w-full h-full pb-20 space-y-10">`);
  }
}

fs.writeFileSync(filepath, code);
console.log('Update complete');
