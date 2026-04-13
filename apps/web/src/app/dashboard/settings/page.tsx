/**
 * Account settings page — /dashboard/settings
 * Change password, update profile info, and manage notification preferences.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { updateProfile, changePassword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import {
  CheckCircle,
  AlertCircle,
  User,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  BadgeCheck,
  DollarSign,
  Building2,
  Users,
  ArrowRight,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function accountTypeLabel(user: {
  userType?: string;
  canSell?: boolean;
  canTransport?: boolean;
}): string {
  if (user.userType === 'ADMIN') return 'Administrators';
  const labels = ['Pircējs'];
  if (user.canSell) labels.push('Pārdevējs');
  if (user.canTransport) labels.push('Pārvadātājs');
  return labels.join(' + ');
}
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Aktīvs', color: '#15803d' },
  PENDING: { label: 'Gaida apstiprinājumu', color: '#b45309' },
  SUSPENDED: { label: 'Apturēts', color: '#b91c1c' },
  REJECTED: { label: 'Noraidīts', color: '#b91c1c' },
};

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  NET30: 'NET 30',
  NET60: 'NET 60',
  COD: 'COD',
};

function StatusFeedback({
  status,
  errMsg,
}: {
  status: 'idle' | 'saving' | 'success' | 'error';
  errMsg: string;
}) {
  if (status === 'success')
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
        <CheckCircle className="h-4 w-4 shrink-0" />
        Izmaiņas saglabātas veiksmīgi!
      </div>
    );
  if (status === 'error')
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {errMsg || 'Kļūda. Lūdzu, mēģiniet vēlreiz.'}
      </div>
    );
  return null;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, token, setAuth } = useAuth();

  // Profile form
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  });
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'success' | 'error'>(
    'idle',
  );
  const [profileErr, setProfileErr] = useState('');

  // Password form
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [pwErr, setPwErr] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const setP = (field: keyof typeof profileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfileForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileStatus('saving');
    setProfileErr('');
    try {
      const updated = await updateProfile(
        {
          firstName: profileForm.firstName.trim() || undefined,
          lastName: profileForm.lastName.trim() || undefined,
          phone: profileForm.phone.trim() || undefined,
        },
        token,
      );
      setAuth(updated, token);
      setProfileStatus('success');
      setTimeout(() => setProfileStatus('idle'), 3000);
    } catch (err: unknown) {
      setProfileErr(err instanceof Error ? err.message : 'Neizdevās saglabāt izmaiņas');
      setProfileStatus('error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwErr('Jaunās paroles nesakrīt');
      setPwStatus('error');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwErr('Jaunajai parolei jābūt vismaz 8 rakstzīmēm.');
      setPwStatus('error');
      return;
    }
    setPwStatus('saving');
    setPwErr('');
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword, token);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwStatus('success');
      setTimeout(() => setPwStatus('idle'), 3500);
    } catch (err: unknown) {
      setPwErr(err instanceof Error ? err.message : 'Neizdevās nomainīt paroli');
      setPwStatus('error');
    }
  };

  const userTypeLabel = user ? accountTypeLabel(user) : '—';
  const statusInfo = STATUS_LABEL[user?.status ?? ''];

  const pwStrength =
    (pwForm.newPassword.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(pwForm.newPassword) ? 1 : 0) +
    (/[0-9]/.test(pwForm.newPassword) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pwForm.newPassword) ? 1 : 0);
  const pwStrengthColor =
    pwStrength <= 1 ? 'bg-red-400' : pwStrength <= 2 ? 'bg-amber-400' : 'bg-green-500';
  const pwStrengthLabel =
    pwForm.newPassword.length === 0
      ? ''
      : pwStrength <= 1
        ? 'Vāja'
        : pwStrength <= 2
          ? 'Vidēja'
          : 'Stipra';

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Iestatījumi" description="Pārvaldiet sava konta informāciju un drošību." />

      <Separator />

      {/* ── Profile card ─────────────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Profila informācija</CardTitle>
          </div>
          <CardDescription>Atjauniniet savu vārdu un kontaktinformāciju.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Vārds</Label>
                <Input
                  id="firstName"
                  value={profileForm.firstName}
                  onChange={setP('firstName')}
                  placeholder="Jānis"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Uzvārds</Label>
                <Input
                  id="lastName"
                  value={profileForm.lastName}
                  onChange={setP('lastName')}
                  placeholder="Bērziņš"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-pasts</Label>
              <Input
                id="email"
                value={user?.email ?? ''}
                disabled
                className="bg-muted cursor-not-allowed text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">E-pastu nevar mainīt.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Tālrunis</Label>
              <Input
                id="phone"
                value={profileForm.phone}
                onChange={setP('phone')}
                placeholder="+371 20000000"
                type="tel"
              />
            </div>
            <StatusFeedback status={profileStatus} errMsg={profileErr} />
            <div className="flex justify-end">
              <Button type="submit" disabled={profileStatus === 'saving'}>
                {profileStatus === 'saving' ? 'Saglabā...' : 'Saglabāt izmaiņas'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Change password card ──────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Nomainīt paroli</CardTitle>
          </div>
          <CardDescription>Izmantojiet stipru paroli ar vismaz 8 rakstzīmēm.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Esošā parole</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  placeholder="Jūsu pašreizējā parole"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Jaunā parole</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Vismaz 8 rakstzīmes"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Atkārtot paroli</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Atkārtojiet jauno paroli"
                />
              </div>
            </div>
            {/* Password strength bar */}
            {pwForm.newPassword.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full transition-colors ${i <= pwStrength ? pwStrengthColor : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{pwStrengthLabel}</p>
              </div>
            )}
            <StatusFeedback status={pwStatus} errMsg={pwErr} />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  pwStatus === 'saving' ||
                  !pwForm.currentPassword ||
                  !pwForm.newPassword ||
                  !pwForm.confirmPassword
                }
              >
                {pwStatus === 'saving' ? 'Saglabā...' : 'Nomainīt paroli'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Account info card ────────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Konta informācija</CardTitle>
          </div>
          <CardDescription>Informācija par jūsu konta veidu un statusu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            {
              label: 'Konta veids',
              node: (
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                  {userTypeLabel}
                </span>
              ),
            },
            {
              label: 'Statuss',
              node: (
                <span
                  className="text-sm font-semibold"
                  style={{ color: statusInfo?.color ?? '#374151' }}
                >
                  {statusInfo?.label ?? user?.status ?? '—'}
                </span>
              ),
            },
            {
              label: 'Uzņēmuma konts',
              node: <span className="text-sm font-semibold">{user?.isCompany ? 'Jā' : 'Nē'}</span>,
            },
            ...(user?.email
              ? [
                  {
                    label: 'E-pasts',
                    node: <span className="text-sm text-muted-foreground">{user.email}</span>,
                  },
                ]
              : []),
          ].map(({ label, node }, i, arr) => (
            <div
              key={label}
              className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b' : ''}`}
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              {node}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Credit limit card (buyers only) ──────────────────── */}
      {user?.userType !== 'ADMIN' && user?.buyerProfile && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Kredītlimits</CardTitle>
            </div>
            <CardDescription>Piemērotu kredītlimitu iestata administrātors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.buyerProfile.creditLimit != null ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Izlietots</span>
                  <span className="font-semibold">
                    €
                    {user.buyerProfile.creditUsed.toLocaleString('lv-LV', {
                      minimumFractionDigits: 2,
                    })}
                    {' / '}€
                    {user.buyerProfile.creditLimit.toLocaleString('lv-LV', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      user.buyerProfile.creditUsed / user.buyerProfile.creditLimit >= 0.9
                        ? 'bg-red-500'
                        : user.buyerProfile.creditUsed / user.buyerProfile.creditLimit >= 0.7
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (user.buyerProfile.creditUsed / user.buyerProfile.creditLimit) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nav noteikts kredītlimits.</p>
            )}
            {user.buyerProfile.paymentTerms && (
              <div className="flex items-center justify-between py-2 border-t">
                <span className="text-sm text-muted-foreground">Maksājumu termiņš</span>
                <span className="inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-1 bg-blue-50 text-blue-700">
                  {PAYMENT_TERMS_LABEL[user.buyerProfile.paymentTerms] ??
                    user.buyerProfile.paymentTerms}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Company & Team quick links ────────────────────────── */}
      {user?.userType !== 'ADMIN' && (
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Uzņēmums & Komanda</CardTitle>
            </div>
            <CardDescription>Pārvaldiet uzņēmuma profilu un dalībniekus.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              href="/dashboard/company"
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Uzņēmuma profils</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </Link>
            <Link
              href="/dashboard/company/team"
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Komanda & Atļaujas</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
