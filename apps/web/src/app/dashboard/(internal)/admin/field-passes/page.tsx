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

  const renderTable = (rows: ApiFieldPass[], title: string) => (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {title} ({rows.length})
      </h2>
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Caurlaide
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Auto / Šoferis
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Uzņēmums
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Statuss
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  No
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Līdz
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Kods
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((pass) => {
                const now = new Date();
                const expired = pass.status === 'ACTIVE' && new Date(pass.validTo) < now;
                const effectiveStatus: FieldPassStatus = expired ? 'EXPIRED' : pass.status;
                const meta = STATUS_META[effectiveStatus];
                const Icon = meta.icon;
                return (
                  <tr key={pass.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold font-mono text-xs text-gray-900">
                        {pass.passNumber}
                      </p>
                      {pass.revokedReason && (
                        <p className="text-xs text-destructive italic mt-0.5 max-w-40 truncate">
                          {pass.revokedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{pass.vehiclePlate}</p>
                      {pass.driverName && (
                        <p className="text-xs text-muted-foreground">{pass.driverName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {pass.company?.name ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={meta.variant} className="text-xs">
                        <Icon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {fmtDate(pass.validFrom)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {fmtDate(pass.validTo)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {pass.wasteClassCode ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {pass.fileUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={pass.fileUrl} target="_blank" rel="noopener noreferrer">
                              PDF
                            </a>
                          </Button>
                        )}
                        {pass.status === 'ACTIVE' && !expired && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setRevokeTarget(pass)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Atcelt
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

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
          {active.length > 0 && renderTable(active, 'Aktīvās')}
          {past.length > 0 && renderTable(past, 'Vēsture')}
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
