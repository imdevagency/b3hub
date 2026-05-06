/**
 * API Key management page — /dashboard/company/integrations
 * Company OWNER and MANAGER can create, view, and revoke API keys
 * for connecting external ERP systems or automation tools to B3Hub.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKey,
  type ApiKeyScope,
  type CreateApiKeyInput,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Clock,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { lv } from 'date-fns/locale';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_SCOPES: { value: ApiKeyScope; label: string; description: string }[] = [
  {
    value: 'orders:read',
    label: 'Pasūtījumi — lasīt',
    description: 'Ielasīt visus uzņēmuma pasūtījumus',
  },
  {
    value: 'orders:write',
    label: 'Pasūtījumi — rakstīt',
    description: 'Izveidot un atjaunināt pasūtījumus',
  },
  {
    value: 'invoices:read',
    label: 'Rēķini — lasīt',
    description: 'Ielasīt visus uzņēmuma rēķinus',
  },
  {
    value: 'transport:read',
    label: 'Transports — lasīt',
    description: 'Ielasīt transporta darbus',
  },
  {
    value: 'materials:read',
    label: 'Materiāli — lasīt',
    description: 'Ielasīt materiālu katalogu',
  },
];

const SCOPE_COLOR: Record<ApiKeyScope, string> = {
  'orders:read': 'bg-blue-100 text-blue-700',
  'orders:write': 'bg-orange-100 text-orange-700',
  'invoices:read': 'bg-green-100 text-green-700',
  'transport:read': 'bg-purple-100 text-purple-700',
  'materials:read': 'bg-teal-100 text-teal-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: ApiKeyScope }) {
  const entry = ALL_SCOPES.find((s) => s.value === scope);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SCOPE_COLOR[scope]}`}
    >
      {entry?.label ?? scope}
    </span>
  );
}

function relativeDate(iso: string | null) {
  if (!iso) return null;
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: lv });
}

// ── Revealed key copy box ─────────────────────────────────────────────────────

function KeyRevealBox({ rawKey }: { rawKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-md border border-green-300 bg-green-50 p-3">
      <p className="text-xs font-medium text-green-800 mb-2 flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" />
        Saglabājiet atslēgu tagad — tā vairs nebūs pieejama
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-white border border-green-200 px-3 py-2 text-xs font-mono text-green-900 break-all">
          {rawKey}
        </code>
        <Button size="icon" variant="outline" onClick={copy} className="shrink-0">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ── Create dialog ─────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (key: ApiKey, rawKey: string) => void;
  token: string;
}

function CreateDialog({ open, onClose, onCreated, token }: CreateDialogProps) {
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setLabel('');
    setScopes([]);
    setSaving(false);
    setError('');
  }

  function toggleScope(scope: ApiKeyScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleSubmit() {
    if (!label.trim()) {
      setError('Ievadiet nosaukumu');
      return;
    }
    if (scopes.length === 0) {
      setError('Izvēlieties vismaz vienu piekļuves jomu');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input: CreateApiKeyInput = { label: label.trim(), scopes };
      const result = await createApiKey(token, input);
      onCreated(result, result.key);
      reset();
    } catch {
      setError('Neizdevās izveidot atslēgu — mēģiniet vēlreiz');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Jauna API atslēga</DialogTitle>
          <DialogDescription>
            Piešķiriet atslēgai nosaukumu un izvēlieties, kurām datu kopām tai ir piekļuve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="api-key-label">Nosaukums</Label>
            <Input
              id="api-key-label"
              placeholder="piem. SAP B1 integrācija"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Piekļuves jomas</Label>
            {ALL_SCOPES.map(({ value, label: scopeLabel, description }) => (
              <div key={value} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id={`scope-${value}`}
                  checked={scopes.includes(value)}
                  onCheckedChange={() => toggleScope(value)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <label htmlFor={`scope-${value}`} className="text-sm font-medium cursor-pointer">
                    {scopeLabel}
                  </label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Izveidot atslēgu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { token, user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const isOwnerOrManager = user?.companyRole === 'OWNER' || user?.companyRole === 'MANAGER';

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listApiKeys(token);
      setKeys(data);
    } catch {
      setError('Neizdevās ielādēt API atslēgas');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function handleCreated(key: ApiKey, rawKey: string) {
    setKeys((prev) => [key, ...prev]);
    setCreateOpen(false);
    setRevealedKey(rawKey);
  }

  async function handleRevoke() {
    if (!revokeId || !token) return;
    setRevoking(true);
    try {
      await revokeApiKey(token, revokeId);
      setKeys((prev) => prev.filter((k) => k.id !== revokeId));
    } catch {
      setError('Neizdevās atsaukt atslēgu — mēģiniet vēlreiz');
    } finally {
      setRevoking(false);
      setRevokeId(null);
    }
  }

  if (!user?.isCompany) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">
          API atslēgas ir pieejamas tikai uzņēmuma kontiem.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <PageHeader
        title="ERP integrācijas"
        description="API atslēgas ļauj ārējām sistēmām (ERP, uzskaites programmatūra) pieslēgties B3Hub platformai."
        action={
          isOwnerOrManager ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauna atslēga
            </Button>
          ) : undefined
        }
      />

      {/* Revealed key banner — shown after creation */}
      {revealedKey && (
        <div className="space-y-2">
          <KeyRevealBox rawKey={revealedKey} />
          <Button variant="ghost" size="sm" onClick={() => setRevealedKey(null)}>
            Aizvērt
          </Button>
        </div>
      )}

      {/* How it works card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            Kā tas darbojas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Izveidojiet API atslēgu un pievienojiet to jūsu ERP sistēmas HTTP pieprasījumiem kā
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              Authorization: Bearer &lt;atslēga&gt;
            </code>
            galveni.
          </p>
          <p>
            Katrai atslēgai var ierobežot piekļuvi tikai nepieciešamajām datu kopām. Atslēgas ir
            saistītas ar jūsu uzņēmumu — tās neatklāj citu uzņēmumu datus.
          </p>
          <div className="pt-1">
            <p className="font-medium text-foreground mb-1">Bāzes URL:</p>
            <code className="rounded bg-muted px-2 py-1 text-xs">
              {process.env.NEXT_PUBLIC_API_URL ?? 'https://api.b3hub.lv'}/api/v1
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Key list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            Aktīvās atslēgas
          </CardTitle>
          <CardDescription>
            {keys.length === 0 && !loading
              ? 'Nav izveidotu atslēgu'
              : `${keys.length} atslēg${keys.length === 1 ? 'a' : 'as'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ielādē...
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={Key}
              title="Nav API atslēgu"
              description="Izveidojiet pirmo atslēgu, lai savienotu ERP sistēmu"
              action={
                isOwnerOrManager ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Izveidot atslēgu
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y">
              {keys.map((key) => (
                <div key={key.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{key.label}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono">
                          {key.keyPrefix}...
                        </code>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <ScopeBadge key={s} scope={s} />
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Izveidota {relativeDate(key.createdAt)}</span>
                        {key.lastUsedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pēdējo reizi izmantota {relativeDate(key.lastUsedAt)}
                          </span>
                        )}
                        {key.expiresAt && <span>Beidzas {relativeDate(key.expiresAt)}</span>}
                      </div>
                    </div>
                    {isOwnerOrManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setRevokeId(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      {token && (
        <CreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
          token={token}
        />
      )}

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atsaukt API atslēgu?</AlertDialogTitle>
            <AlertDialogDescription>
              Šī darbība ir neatgriezeniska. Atslēga tiks nekavējoties deaktivizēta un jebkura
              integrācija, kas to izmanto, pārstās darboties.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Atcelt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atsaukt atslēgu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
