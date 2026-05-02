/**
 * Company profile page — /dashboard/company
 * View and edit the company profile: name, registration number, logo upload.
 */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getMyCompany, updateMyCompany, lookupCompanyByRegcode, type Company } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle, AlertCircle, Loader2, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

type FormState = {
  name: string;
  legalName: string;
  registrationNum: string;
  vatId: string;
  email: string;
  phone: string;
  website: string;
  description: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
};

export default function CompanyPage() {
  const { token, user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [urLookupState, setUrLookupState] = useState<'idle' | 'loading' | 'found' | 'notfound'>(
    'idle',
  );
  const [form, setForm] = useState<FormState>({
    name: '',
    legalName: '',
    registrationNum: '',
    vatId: '',
    email: '',
    phone: '',
    website: '',
    description: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
  });

  useEffect(() => {
    if (!token) return;
    getMyCompany(token)
      .then((c) => {
        setCompany(c);
        setForm({
          name: c.name ?? '',
          legalName: c.legalName ?? '',
          registrationNum: c.registrationNum ?? '',
          vatId: c.taxId ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          website: c.website ?? '',
          description: c.description ?? '',
          street: c.street ?? '',
          city: c.city ?? '',
          state: c.state ?? '',
          postalCode: c.postalCode ?? '',
        });
      })
      .catch(() => setErrMsg('Neizdevās ielādēt uzņēmuma datus'))
      .finally(() => setLoading(false));
  }, [token]);

  const isOwnerOrManager = user?.companyRole === 'OWNER' || user?.companyRole === 'MANAGER';

  const set =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleUrLookup = async () => {
    const regcode = form.registrationNum.replace(/\D/g, '');
    if (regcode.length !== 11) return;
    setUrLookupState('loading');
    try {
      const result = await lookupCompanyByRegcode(regcode);
      if (!result.found) {
        setUrLookupState('notfound');
        return;
      }
      // Parse address: "Rīga, Brīvības iela 10" → try to extract street + city
      const address = result.address ?? '';
      const parts = address.split(',').map((s) => s.trim());
      const city = parts[0] ?? '';
      const street = parts.slice(1).join(', ') || '';
      setForm((f) => ({
        ...f,
        legalName: result.legalName ?? f.legalName,
        name: f.name || result.name || f.name,
        street: street || f.street,
        city: city || f.city,
      }));
      setUrLookupState('found');
      setTimeout(() => setUrLookupState('idle'), 3000);
    } catch {
      setUrLookupState('notfound');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isOwnerOrManager) return;
    setStatus('saving');
    setErrMsg('');
    try {
      const updated = await updateMyCompany(
        {
          name: form.name.trim() || undefined,
          legalName: form.legalName.trim() || undefined,
          registrationNum: form.registrationNum.trim() || undefined,
          vatId: form.vatId.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          website: form.website.trim() || undefined,
          description: form.description.trim() || undefined,
          street: form.street.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
        },
        token,
      );
      setCompany(updated);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : 'Neizdevās saglabāt izmaiņas');
      setStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Ielādē uzņēmuma datus…</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="max-w-2xl p-8 text-center text-muted-foreground">
        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>{errMsg || 'Uzņēmums nav atrasts.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Uzņēmuma profils"
        description="Pārvaldiet uzņēmuma informāciju un kontaktdatus."
        action={
          company.verified ? (
            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Verificēts
            </Badge>
          ) : (
            <Badge variant="secondary">Nav verificēts</Badge>
          )
        }
      />

      <Separator />

      <form onSubmit={handleSave} className="space-y-6">
        {/* General */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Vispārīgā informācija</CardTitle>
            </div>
            <CardDescription>
              Uzņēmuma nosaukums, juridiskā informācija un kontakti.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Uzņēmuma nosaukums</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="SIA Būvlaukums"
                  disabled={!isOwnerOrManager}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="legalName">Juridiskais nosaukums</Label>
                <Input
                  id="legalName"
                  value={form.legalName}
                  onChange={set('legalName')}
                  placeholder="SIA Būvlaukums"
                  disabled={!isOwnerOrManager}
                />
              </div>
            </div>

            {/* Registration number with UR lookup */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="registrationNum">Reģistrācijas numurs</Label>
                <div className="flex gap-2">
                  <Input
                    id="registrationNum"
                    value={form.registrationNum}
                    onChange={(e) => {
                      set('registrationNum')(e);
                      if (urLookupState !== 'idle') setUrLookupState('idle');
                    }}
                    placeholder="40003009945"
                    disabled={!isOwnerOrManager}
                    maxLength={11}
                  />
                  {isOwnerOrManager && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      disabled={
                        form.registrationNum.replace(/\D/g, '').length !== 11 ||
                        urLookupState === 'loading'
                      }
                      onClick={handleUrLookup}
                      title="Meklēt Uzņēmumu reģistrā"
                    >
                      {urLookupState === 'loading' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                {urLookupState === 'found' && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Atrasts UR — dati automātiski aizpildīti
                  </p>
                )}
                {urLookupState === 'notfound' && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Nav atrasts Uzņēmumu reģistrā
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vatId">PVN reģistrācijas numurs</Label>
                <Input
                  id="vatId"
                  value={form.vatId}
                  onChange={set('vatId')}
                  placeholder="LV40003009945"
                  disabled={!isOwnerOrManager}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-pasts</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="info@buvlaukums.lv"
                  disabled={!isOwnerOrManager}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Tālrunis</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+371 20000000"
                  disabled={!isOwnerOrManager}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website">Mājaslapa</Label>
              <Input
                id="website"
                value={form.website}
                onChange={set('website')}
                placeholder="https://buvlaukums.lv"
                disabled={!isOwnerOrManager}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Apraksts</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={set('description')}
                placeholder="Īss uzņēmuma darbības apraksts…"
                rows={3}
                disabled={!isOwnerOrManager}
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adrese</CardTitle>
            <CardDescription>Uzņēmuma juridiskā vai faktiskā adrese.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="street">Iela</Label>
              <Input
                id="street"
                value={form.street}
                onChange={set('street')}
                placeholder="Brīvības iela 1"
                disabled={!isOwnerOrManager}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="postalCode">Pasta indekss</Label>
                <Input
                  id="postalCode"
                  value={form.postalCode}
                  onChange={set('postalCode')}
                  placeholder="LV-1050"
                  disabled={!isOwnerOrManager}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="city">Pilsēta</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={set('city')}
                  placeholder="Rīga"
                  disabled={!isOwnerOrManager}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="state">Novads/Reģions</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={set('state')}
                  placeholder="Rīgas novads"
                  disabled={!isOwnerOrManager}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isOwnerOrManager && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={status === 'saving'}>
              {status === 'saving' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Saglabāt izmaiņas
            </Button>
            {status === 'success' && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Saglabāts!
              </p>
            )}
            {status === 'error' && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errMsg}
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
