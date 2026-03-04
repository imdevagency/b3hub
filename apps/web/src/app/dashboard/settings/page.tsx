'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { updateProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, User, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user, token, setAuth } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setStatus('saving');
    setErrMsg('');
    try {
      const updated = await updateProfile(
        {
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          phone: form.phone.trim() || undefined,
        },
        token,
      );
      setAuth(updated, token);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : 'Neizdevās saglabāt izmaiņas');
      setStatus('error');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Iestatījumi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pārvaldiet sava konta informāciju un drošību.
        </p>
      </div>

      <Separator />

      {/* Profile card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Profila informācija</CardTitle>
          </div>
          <CardDescription>Atjauniniet savu vārdu un kontaktinformāciju.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Vārds</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={set('firstName')}
                  placeholder="Jānis"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Uzvārds</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={set('lastName')}
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
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">E-pastu nevar mainīt.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Tālrunis</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+371 20000000"
                type="tel"
              />
            </div>

            {/* Status feedback */}
            {status === 'success' && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Izmaiņas saglabātas veiksmīgi!
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errMsg || 'Kļūda. Lūdzu, mēģiniet vēlreiz.'}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={status === 'saving'}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {status === 'saving' ? 'Saglabā...' : 'Saglabāt izmaiņas'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account info card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Konta informācija</CardTitle>
          </div>
          <CardDescription>Informācija par jūsu konta veidu un statusu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Konta veids', value: user?.userType ?? '—' },
            { label: 'Statuss', value: user?.status ?? '—' },
            { label: 'Uzņēmuma konts', value: user?.isCompany ? 'Jā' : 'Nē' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
