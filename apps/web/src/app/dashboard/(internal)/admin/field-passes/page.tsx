/**
 * Admin — All Field Passes
 * /dashboard/admin/field-passes
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Ticket, XCircle, CheckCircle2, Clock, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtDate } from '@/lib/format';
import {
  getFieldPassesAdmin,
  revokeFieldPass,
  type ApiFieldPass,
  type FieldPassStatus,
} from '@/lib/api';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  FieldPassStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    icon: React.ElementType;
  }
> = {
  ACTIVE: { label: 'Aktīva', variant: 'default', icon: CheckCircle2 },
  EXPIRED: { label: 'Beigusies', variant: 'secondary', icon: Clock },
  REVOKED: { label: 'Atcelta', variant: 'destructive', icon: XCircle },
};

// ─── Pass row ─────────────────────────────────────────────────────────────────

function PassRow({ pass, onRevoke }: { pass: ApiFieldPass; onRevoke: (p: ApiFieldPass) => void }) {
  const now = new Date();
  const expired = pass.status === 'ACTIVE' && new Date(pass.validTo) < now;
  const effectiveStatus: FieldPassStatus = expired ? 'EXPIRED' : pass.status;
  const meta = STATUS_META[effectiveStatus];
  const Icon = meta.icon;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-600">
              <Ticket className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{pass.passNumber}</span>
                <Badge variant={meta.variant} className="text-xs">
                  <Icon className="h-3 w-3 mr-1" />
                  {meta.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pass.vehiclePlate}
                {pass.driverName ? ` · ${pass.driverName}` : ''}
              </p>
              {pass.company && <p className="text-xs text-muted-foreground">{pass.company.name}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pass.fileUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={pass.fileUrl} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>
              </Button>
            )}
            {pass.status === 'ACTIVE' && !expired && (
              <Button variant="destructive" size="sm" onClick={() => onRevoke(pass)}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Atcelt
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground/70">No: </span>
            {fmtDate(pass.validFrom)}
          </div>
          <div>
            <span className="font-medium text-foreground/70">Līdz: </span>
            {fmtDate(pass.validTo)}
          </div>
          {pass.wasteClassCode && (
            <div>
              <span className="font-medium text-foreground/70">Kods: </span>
              {pass.wasteClassCode}
            </div>
          )}
          {pass.unloadingPoint && (
            <div>
              <span className="font-medium text-foreground/70">Izkraušana: </span>
              {pass.unloadingPoint}
            </div>
          )}
          {pass.revokedReason && (
            <div className="col-span-2 mt-1 pt-1.5 border-t text-destructive">
              <span className="font-medium">Atcelšanas iemesls: </span>
              {pass.revokedReason}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFieldPassesPage() {
  const { token, user } = useAuth();
  const [passes, setPasses] = useState<ApiFieldPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<ApiFieldPass | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getFieldPassesAdmin(token);
      setPasses(data);
    } catch {
      // show empty state
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async () => {
    if (!token || !revokeTarget) return;
    setRevoking(true);
    try {
      await revokeFieldPass(revokeTarget.id, revokeReason, token);
      setRevokeTarget(null);
      setRevokeReason('');
      await load();
    } finally {
      setRevoking(false);
    }
  };

  // Guard: admin only
  if (user && user.userType !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <ShieldAlert className="h-8 w-8" />
        <p className="text-sm">Nav piekļuves</p>
      </div>
    );
  }

  const active = passes.filter((p) => p.status === 'ACTIVE' && new Date(p.validTo) >= new Date());
  const past = passes.filter((p) => p.status !== 'ACTIVE' || new Date(p.validTo) < new Date());

  return (
    <>
      <PageHeader
        title="Caurlaides (Admin)"
        description="Visu uzņēmumu laukuma piekļuves caurlaides"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : passes.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Nav caurlaiţu"
          description="Neviens uzņēmums vēl nav izveidojis caurlaides"
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Aktīvās ({active.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((p) => (
                  <PassRow key={p.id} pass={p} onRevoke={setRevokeTarget} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Vēsture ({past.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {past.map((p) => (
                  <PassRow key={p.id} pass={p} onRevoke={setRevokeTarget} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Revoke dialog */}
      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
            setRevokeReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atcelt caurlaidi {revokeTarget?.passNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Atcelšanas iemesls</Label>
              <Input
                placeholder="Norādiet iemeslu..."
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Atcelt
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking || !revokeReason.trim()}
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apstiprināt atcelšanu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
