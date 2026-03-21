/**
 * Team management page — /dashboard/company/team
 * Invite members, assign roles and permissions within the company.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getCompanyMembers,
  inviteCompanyMember,
  updateCompanyMember,
  removeCompanyMember,
  type CompanyMember,
  type CompanyRole,
  type InviteMemberInput,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Truck,
  Package,
  Loader2,
  AlertCircle,
  Copy,
  CheckCircle,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────

const ROLE_LABEL: Record<CompanyRole, string> = {
  OWNER: 'Īpašnieks',
  MANAGER: 'Pārvaldnieks',
  DRIVER: 'Vadītājs',
  MEMBER: 'Dalībnieks',
};

const ROLE_VARIANT: Record<CompanyRole, string> = {
  OWNER: 'bg-red-100 text-red-700',
  MANAGER: 'bg-purple-100 text-purple-700',
  DRIVER: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-gray-100 text-gray-700',
};

function RoleBadge({ role }: { role?: CompanyRole }) {
  if (!role) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_VARIANT[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function initials(m: CompanyMember) {
  return `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase();
}

// ── Invite dialog ────────────────────────────────────────────

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  onInvited: (member: CompanyMember, tempPwd: string) => void;
  token: string;
  canInviteManager: boolean;
}

const EMPTY_INVITE: InviteMemberInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  companyRole: 'DRIVER',
  canTransport: false,
  canSell: false,
};

function InviteDialog({ open, onClose, onInvited, token, canInviteManager }: InviteDialogProps) {
  const [form, setForm] = useState<InviteMemberInput>(EMPTY_INVITE);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (key: keyof InviteMemberInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErr('Vārds un uzvārds ir obligāti.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const result = await inviteCompanyMember(
        {
          ...form,
          email: form.email?.trim() || undefined,
          phone: form.phone?.trim() || undefined,
        },
        token,
      );
      onInvited(result.user, result.tempPassword);
      setForm(EMPTY_INVITE);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Neizdevās pievienot darbinieku.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md w-[90vw] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Pievienot darbinieku</SheetTitle>
          <SheetDescription>
            Izveidojiet kontu jaunam komandas loceklim. Pagaidu parole tiks parādīta vienu reizi.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-first">Vārds *</Label>
              <Input
                id="inv-first"
                value={form.firstName}
                onChange={set('firstName')}
                placeholder="Jānis"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-last">Uzvārds *</Label>
              <Input
                id="inv-last"
                value={form.lastName}
                onChange={set('lastName')}
                placeholder="Bērziņš"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-email">E-pasts</Label>
            <Input
              id="inv-email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="jberzins@uznemums.lv"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-phone">Tālrunis</Label>
            <Input
              id="inv-phone"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+371 20000000"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Loma</Label>
            <Select
              value={form.companyRole}
              onValueChange={(v) => setForm((f) => ({ ...f, companyRole: v as CompanyRole }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canInviteManager && <SelectItem value="MANAGER">Pārvaldnieks</SelectItem>}
                <SelectItem value="DRIVER">Vadītājs</SelectItem>
                <SelectItem value="MEMBER">Dalībnieks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Atļaujas</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.canTransport ?? false}
                  onChange={(e) => setForm((f) => ({ ...f, canTransport: e.target.checked }))}
                  className="rounded"
                />
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                Var transportēt
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.canSell ?? false}
                  onChange={(e) => setForm((f) => ({ ...f, canSell: e.target.checked }))}
                  className="rounded"
                />
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Var pārdot
              </label>
            </div>
          </div>

          {err && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {err}
            </p>
          )}

          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Atcelt
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pievienot
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Temp password reveal dialog ───────────────────────────────

interface TempPwdDialogProps {
  open: boolean;
  member: CompanyMember | null;
  password: string;
  onClose: () => void;
}

function TempPwdDialog({ open, member, password, onClose }: TempPwdDialogProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:sm:max-w-md w-[90vw] sm:w-[400px] w-[90vw] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Darbinieks pievienots!
          </SheetTitle>
          <SheetDescription>
            Nosūtiet šo pagaidu paroli darbiniekam{' '}
            <strong>
              {member?.firstName} {member?.lastName}
            </strong>
            . Parole tiks parādīta tikai vienu reizi.
          </SheetDescription>
        </SheetHeader>
        <div className="bg-muted rounded-md p-3 flex items-center justify-between gap-2 font-mono text-sm">
          <span className="select-all">{password}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 shrink-0"
            onClick={copy}
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        {member?.email && (
          <p className="text-xs text-muted-foreground">
            Pieteikšanās e-pasts: <strong>{member.email}</strong>
          </p>
        )}
        <SheetFooter>
          <Button onClick={onClose}>Aizvērt</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Edit member dialog ────────────────────────────────────────

interface EditDialogProps {
  open: boolean;
  member: CompanyMember | null;
  onClose: () => void;
  onSaved: (updated: CompanyMember) => void;
  token: string;
  canPromoteToManager: boolean;
}

function EditDialog({
  open,
  member,
  onClose,
  onSaved,
  token,
  canPromoteToManager,
}: EditDialogProps) {
  const [role, setRole] = useState<CompanyRole>(member?.companyRole ?? 'DRIVER');
  const [canTransport, setCanTransport] = useState(member?.canTransport ?? false);
  const [canSell, setCanSell] = useState(member?.canSell ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Sync with selected member
  useEffect(() => {
    if (member) {
      setRole(member.companyRole ?? 'DRIVER');
      setCanTransport(member.canTransport ?? false);
      setCanSell(member.canSell ?? false);
    }
  }, [member]);

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    setErr('');
    try {
      const updated = await updateCompanyMember(
        member.id,
        { companyRole: role, canTransport, canSell },
        token,
      );
      onSaved(updated);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Neizdevās saglabāt izmaiņas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:sm:max-w-md w-[90vw] sm:w-[400px] w-[90vw] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Rediģēt dalībnieku</SheetTitle>
          <SheetDescription>
            {member?.firstName} {member?.lastName}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Loma</Label>
            <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canPromoteToManager && <SelectItem value="MANAGER">Pārvaldnieks</SelectItem>}
                <SelectItem value="DRIVER">Vadītājs</SelectItem>
                <SelectItem value="MEMBER">Dalībnieks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Atļaujas</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={canTransport}
                  onChange={(e) => setCanTransport(e.target.checked)}
                  className="rounded"
                />
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                Var transportēt
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={canSell}
                  onChange={(e) => setCanSell(e.target.checked)}
                  className="rounded"
                />
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Var pārdot
              </label>
            </div>
          </div>

          {err && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {err}
            </p>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Saglabāt
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function CompanyTeamPage() {
  const { token, user } = useAuth();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  // Dialogs
  const [inviteOpen, setInviteOpen] = useState(false);
  const [tempPwd, setTempPwd] = useState<{ member: CompanyMember; password: string } | null>(null);
  const [editTarget, setEditTarget] = useState<CompanyMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CompanyMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeErr, setRemoveErr] = useState('');

  const isOwner = user?.companyRole === 'OWNER';
  const isManager = user?.companyRole === 'MANAGER';
  const canManage = isOwner || isManager;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getCompanyMembers(token);
      setMembers(data);
    } catch {
      setErrMsg('Neizdevās ielādēt komandas dalībniekus.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvited = (member: CompanyMember, password: string) => {
    setMembers((prev) => [member, ...prev]);
    setInviteOpen(false);
    setTempPwd({ member, password });
  };

  const handleSaved = (updated: CompanyMember) => {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setEditTarget(null);
  };

  const handleRemove = async () => {
    if (!removeTarget || !token) return;
    setRemoving(true);
    setRemoveErr('');
    try {
      await removeCompanyMember(removeTarget.id, token);
      setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch (ex: unknown) {
      setRemoveErr(ex instanceof Error ? ex.message : 'Neizdevās noņemt dalībnieku.');
    } finally {
      setRemoving(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'ACTIVE')
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
          Aktīvs
        </Badge>
      );
    if (status === 'DEACTIVATED')
      return (
        <Badge variant="secondary" className="text-xs">
          Deaktivizēts
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-xs">
        {status}
      </Badge>
    );
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Komanda"
        description="Pārvaldiet uzņēmuma darbiniekus un to atļaujas."
        action={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Pievienot darbinieku
            </Button>
          ) : undefined
        }
      />

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Komandas dalībnieki</CardTitle>
          </div>
          <CardDescription>{members.length} dalībnieki uzņēmumā</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Ielādē…</span>
            </div>
          ) : errMsg ? (
            <p className="text-sm text-red-600 flex items-center gap-1 py-4">
              <AlertCircle className="h-4 w-4" />
              {errMsg}
            </p>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nav dalībnieku. Pievienojiet pirmo darbinieku!</p>
            </div>
          ) : (
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-4 py-3">
                  <Avatar className="h-9 w-9 shrink-0 rounded-lg">
                    {m.avatar && <AvatarImage src={m.avatar} alt={initials(m)} />}
                    <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold">
                      {initials(m)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {m.firstName} {m.lastName}
                      </span>
                      <RoleBadge role={m.companyRole} />
                      {statusBadge(m.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      {m.email && <span>{m.email}</span>}
                      {m.phone && <span>{m.phone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    {m.canTransport && (
                      <span className="flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
                        <Truck className="h-3 w-3" />
                        Transport
                      </span>
                    )}
                    {m.canSell && (
                      <span className="flex items-center gap-1 bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
                        <Package className="h-3 w-3" />
                        Pārdot
                      </span>
                    )}
                  </div>

                  {canManage && m.companyRole !== 'OWNER' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTarget(m)}>
                          Rediģēt
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          onClick={() => setRemoveTarget(m)}
                        >
                          Noņemt no komandas
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={handleInvited}
        token={token ?? ''}
        canInviteManager={isOwner}
      />

      {/* Temp password reveal */}
      <TempPwdDialog
        open={!!tempPwd}
        member={tempPwd?.member ?? null}
        password={tempPwd?.password ?? ''}
        onClose={() => setTempPwd(null)}
      />

      {/* Edit dialog */}
      <EditDialog
        open={!!editTarget}
        member={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleSaved}
        token={token ?? ''}
        canPromoteToManager={isOwner}
      />

      {/* Remove confirmation dialog */}
      <Sheet open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <SheetContent className="sm:sm:max-w-md w-[90vw] sm:w-[400px] w-[90vw] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Noņemt no komandas?</SheetTitle>
            <SheetDescription>
              Vai tiešām vēlaties noņemt{' '}
              <strong>
                {removeTarget?.firstName} {removeTarget?.lastName}
              </strong>{' '}
              no komandas? Viņu konts tiks deaktivizēts.
            </SheetDescription>
          </SheetHeader>
          {removeErr && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {removeErr}
            </p>
          )}
          <SheetFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Atcelt
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Noņemt
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
