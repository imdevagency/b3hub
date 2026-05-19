'use client';

/**
 * Generic catalogue editor — used by all taxonomy admin pages.
 * Renders a list with inline sort, active toggle, edit & delete,
 * plus a dialog for creating / updating entries.
 *
 * Usage: pass a `config` object describing the fields for that type.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/page-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2, AlertCircle, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldDef =
  | { key: string; label: string; type: 'text' | 'number' | 'boolean'; required?: boolean }
  | { key: string; label: string; type: 'select'; options: string[]; required?: boolean };

export interface CatalogueEditorConfig {
  title: string;
  description: string;
  codeLabel?: string;
  /** Extra fields shown after code/label/labelLv */
  extraFields: FieldDef[];
  /** Which key to use as the secondary display line */
  subtitleKey?: string;
  /** Badge key (string) */
  badgeKey?: string;
  /** Called to load all items */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadItems: (token: string) => Promise<any[]>;
  /** Called to save (create or update) */
  saveItem: (code: string, data: Record<string, unknown>, token: string) => Promise<unknown>;
  /** Called to delete */
  deleteItem: (code: string, token: string) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

const BASE_FIELDS: FieldDef[] = [
  { key: 'label', label: 'Label (EN)', type: 'text', required: true },
  { key: 'labelLv', label: 'Label (LV)', type: 'text' },
  { key: 'description', label: 'Apraksts (EN)', type: 'text' },
  { key: 'descriptionLv', label: 'Apraksts (LV)', type: 'text' },
  { key: 'sortOrder', label: 'Kārtas nr.', type: 'number' },
  { key: 'isActive', label: 'Aktīvs', type: 'boolean' },
];

function buildEmptyForm(extra: FieldDef[]): Record<string, string | boolean> {
  const form: Record<string, string | boolean> = {
    code: '',
    label: '',
    labelLv: '',
    description: '',
    descriptionLv: '',
    sortOrder: '0',
    isActive: true,
  };
  for (const f of extra) {
    form[f.key] = f.type === 'boolean' ? false : '';
  }
  return form;
}

function recordToForm(item: Record<string, unknown>): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(item)) {
    if (typeof v === 'boolean') {
      out[k] = v;
    } else if (v == null) {
      out[k] = '';
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

function formToPayload(
  form: Record<string, string | boolean>,
  allFields: FieldDef[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of allFields) {
    const raw = form[f.key];
    if (f.type === 'boolean') {
      out[f.key] = Boolean(raw);
    } else if (f.type === 'number') {
      out[f.key] = raw === '' ? undefined : Number(raw);
    } else {
      out[f.key] = raw === '' ? undefined : raw;
    }
  }
  return out;
}

export function CatalogueEditor({ config }: { config: CatalogueEditorConfig }) {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const allFields: FieldDef[] = [...BASE_FIELDS, ...config.extraFields];

  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>(
    buildEmptyForm(config.extraFields),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setItems(await config.loadItems(token));
    } catch {
      setError('Neizdevās ielādēt datus');
    } finally {
      setLoading(false);
    }
  }, [token, config]);

  useEffect(() => {
    if (!authLoading && token) load();
  }, [authLoading, token, load]);

  function openNew() {
    setEditingCode(null);
    setForm(buildEmptyForm(config.extraFields));
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(item: Record<string, unknown>) {
    setEditingCode(item.code as string);
    setForm(recordToForm(item));
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    const code = editingCode ?? (form.code as string).trim().toUpperCase().replace(/\s+/g, '_');
    if (!code) {
      setFormError('Kods ir obligāts');
      return;
    }
    if (!(form.label as string).trim()) {
      setFormError('Nosaukums ir obligāts');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await config.saveItem(code, formToPayload(form, allFields), token);
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Saglabāšanas kļūda');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: string) {
    if (!confirm(`Dzēst "${code}"? Šo darbību nevar atcelt.`)) return;
    try {
      await config.deleteItem(code, token);
      await load();
    } catch {
      setError('Dzēšanas kļūda');
    }
  }

  async function toggleActive(item: Record<string, unknown>) {
    try {
      await config.saveItem(item.code as string, { isActive: !item.isActive }, token);
      await load();
    } catch {
      setError('Kļūda mainot statusu');
    }
  }

  function setField(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (authLoading || loading) return <PageSpinner />;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title={config.title}
        description={config.description}
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            Jauns ieraksts
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {items.length} ieraksts{items.length !== 1 ? 'i' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={Database}
              title="Nav ierakstu"
              description="Izveidojiet pirmo ierakstu ar pogu augšā."
              className="py-16"
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground text-xs uppercase">
                  <th className="px-4 py-2 text-left">Kods</th>
                  <th className="px-4 py-2 text-left">Nosaukums</th>
                  {config.badgeKey && <th className="px-4 py-2 text-left">Grupa</th>}
                  <th className="px-4 py-2 text-center">Kārta</th>
                  <th className="px-4 py-2 text-center">Aktīvs</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.code as string}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      !item.isActive && 'opacity-50',
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {item.code as string}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">
                        {(item.labelLv as string) || (item.label as string)}
                      </div>
                      {config.subtitleKey && !!item[config.subtitleKey] && (
                        <div className="text-xs text-muted-foreground">
                          {item[config.subtitleKey] as string}
                        </div>
                      )}
                    </td>
                    {config.badgeKey && (
                      <td className="px-4 py-2.5">
                        {!!item[config.badgeKey] && (
                          <Badge variant="outline" className="text-xs">
                            {item[config.badgeKey] as string}
                          </Badge>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-center text-muted-foreground">
                      {item.sortOrder as number}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Switch
                        checked={Boolean(item.isActive)}
                        onCheckedChange={() => toggleActive(item)}
                        className="scale-75"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Rediģēt
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(item.code as string)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Dzēst
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCode ? `Rediģēt: ${editingCode}` : 'Jauns ieraksts'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Code field — only shown for new entries */}
            {!editingCode && (
              <div className="space-y-1.5">
                <Label>
                  Kods <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.code as string}
                  onChange={(e) =>
                    setField('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))
                  }
                  placeholder="PIEMERS_KODS"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Unikāls identifikators. Pēc izveidošanas nemainīgs.
                </p>
              </div>
            )}

            {/* Base fields */}
            {BASE_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>
                  {f.label}
                  {f.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {f.type === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(form[f.key])}
                      onCheckedChange={(v) => setField(f.key, v)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {Boolean(form[f.key]) ? 'Jā' : 'Nē'}
                    </span>
                  </div>
                ) : f.type === 'number' ? (
                  <Input
                    type="number"
                    value={form[f.key] as string}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                ) : (
                  <Input
                    value={form[f.key] as string}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}

            {/* Extra fields */}
            {config.extraFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>
                  {f.label}
                  {f.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {f.type === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(form[f.key])}
                      onCheckedChange={(v) => setField(f.key, v)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {Boolean(form[f.key]) ? 'Jā' : 'Nē'}
                    </span>
                  </div>
                ) : f.type === 'number' ? (
                  <Input
                    type="number"
                    step="any"
                    value={form[f.key] as string}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                ) : f.type === 'select' ? (
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={form[f.key] as string}
                    onChange={(e) => setField(f.key, e.target.value)}
                  >
                    <option value="">— Izvēlēties —</option>
                    {(f as { options: string[] }).options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={form[f.key] as string}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saglabā...' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
