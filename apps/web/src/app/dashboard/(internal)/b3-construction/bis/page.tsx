'use client';

/**
 * /dashboard/b3-construction/bis
 *
 * BIS (Būvniecības informācijas sistēma) Integration Module
 * https://bis.gov.lv
 *
 * Provides admins with:
 * 1. Company lookup — search Būvkomersantu reģistrs by name or reg.nr
 * 2. Specialist lookup — search Būvspeciālistu reģistrs by name
 * 3. Quick links — direct links to all BIS public registries
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Building2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  HardHat,
  BookOpen,
  FileText,
  Home,
  Zap,
  Settings2,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  bisSearchCompanies,
  bisSearchSpecialists,
  bisClearCache,
  getBisSettings,
  updateBisSettings,
  bisTestConnection,
  type BisCompany,
  type BisSpecialist,
  type BisSettings,
} from '@/lib/api/bis';

// ─── Status helpers ──────────────────────────────────────────────────────────

function CompanyStatusBadge({ status }: { status: string }) {
  if (status === 'NAV_DATU') {
    return (
      <Badge variant="outline" className="gap-1 text-gray-500">
        <AlertCircle className="h-3 w-3" />
        Nav datu
      </Badge>
    );
  }
  const active = /aktīv|active|reģistr/i.test(status);
  if (active) {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3" />
        Aktīvs
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50">
      <XCircle className="h-3 w-3" />
      {status}
    </Badge>
  );
}

// ─── Quick-links data ────────────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    label: 'Būvkomersantu reģistrs',
    description: 'Licencēti būvkomersanti un to klasifikācija',
    href: 'https://bis.gov.lv/bisp/lv/construction_companies',
    icon: HardHat,
    color: 'bg-orange-50 text-orange-600',
  },
  {
    label: 'Būvspeciālistu reģistrs',
    description: 'Sertificēti būvspeciālisti un viņu kompetences',
    href: 'https://bis.gov.lv/bisp/lv/specialist_certificates',
    icon: Award,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'Aktuālā būvniecība',
    description: 'Spēkā esoši būvatļaujas un ieceres',
    href: 'https://bis.gov.lv/bisp/lv/planned_constructions',
    icon: Building2,
    color: 'bg-violet-50 text-violet-600',
  },
  {
    label: 'Neatkarīgo ekspertu reģistrs',
    description: 'Sertificēti neatkarīgie eksperti',
    href: 'https://bis.gov.lv/bisp/lv/expert_certificates',
    icon: ShieldCheck,
    color: 'bg-green-50 text-green-600',
  },
  {
    label: 'Ēku energosertifikāti',
    description: 'Izsniegti ēku energoefektivitātes sertifikāti',
    href: 'https://bis.gov.lv/bisp/lv/epc_documents',
    icon: Zap,
    color: 'bg-yellow-50 text-yellow-600',
  },
  {
    label: 'Būvinspektoru reģistrs',
    description: 'Sertificēti būvinspektori',
    href: 'https://bis.gov.lv/bisp/lv/building_inspectors',
    icon: FileText,
    color: 'bg-slate-50 text-slate-600',
  },
  {
    label: 'Dzīvojamo māju pārvaldnieki',
    description: 'Licencēti dzīvojamo māju pārvaldnieki',
    href: 'https://bis.gov.lv/bisp/lv/house_managers',
    icon: Home,
    color: 'bg-pink-50 text-pink-600',
  },
  {
    label: 'BIS sākumlapa',
    description: 'Būvniecības informācijas sistēma — galvenā lapa',
    href: 'https://bis.gov.lv',
    icon: BookOpen,
    color: 'bg-gray-50 text-gray-600',
  },
];

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BisPage() {
  const { token } = useAuth();

  // Company search state
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<BisCompany[]>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companySearched, setCompanySearched] = useState(false);

  // Specialist search state
  const [specialistQuery, setSpecialistQuery] = useState('');
  const [specialistResults, setSpecialistResults] = useState<BisSpecialist[]>([]);
  const [specialistLoading, setSpecialistLoading] = useState(false);
  const [specialistError, setSpecialistError] = useState<string | null>(null);
  const [specialistSearched, setSpecialistSearched] = useState(false);

  // Cache clear
  const [clearing, setClearing] = useState(false);

  // Connection / settings tab
  const [settings, setSettings] = useState<BisSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ─── Load settings on mount ────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    setSettingsLoading(true);
    getBisSettings(token)
      .then((s) => {
        setSettings(s);
        setClientId(s.clientId);
        setApiBaseUrl(s.apiBaseUrl);
        setEnabled(s.enabled);
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, [token]);

  const handleSaveSettings = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setSaveResult(null);
    try {
      await updateBisSettings(token, { clientId, clientSecret, apiBaseUrl, enabled });
      const updated = await getBisSettings(token);
      setSettings(updated);
      setClientSecret('');
      setSaveResult({ ok: true, message: 'Iestatījumi saglabāti' });
    } catch {
      setSaveResult({ ok: false, message: 'Neizdevās saglabāt iestatījumus' });
    } finally {
      setSaving(false);
    }
  }, [token, clientId, clientSecret, apiBaseUrl, enabled]);

  const handleTestConnection = useCallback(async () => {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await bisTestConnection(token);
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: 'Neizdevās pārbaudīt savienojumu' });
    } finally {
      setTesting(false);
    }
  }, [token]);

  // ─── Company search ─────────────────────────────────────────────────────

  const handleCompanySearch = useCallback(async () => {
    if (!token || !companyQuery.trim()) return;
    setCompanyLoading(true);
    setCompanyError(null);
    setCompanySearched(false);
    try {
      const results = await bisSearchCompanies(token, companyQuery.trim());
      setCompanyResults(results);
      setCompanySearched(true);
    } catch {
      setCompanyError('Neizdevās meklēt BIS. Pārbaudiet savienojumu.');
    } finally {
      setCompanyLoading(false);
    }
  }, [token, companyQuery]);

  // ─── Specialist search ──────────────────────────────────────────────────

  const handleSpecialistSearch = useCallback(async () => {
    if (!token || !specialistQuery.trim()) return;
    setSpecialistLoading(true);
    setSpecialistError(null);
    setSpecialistSearched(false);
    try {
      const results = await bisSearchSpecialists(token, specialistQuery.trim());
      setSpecialistResults(results);
      setSpecialistSearched(true);
    } catch {
      setSpecialistError('Neizdevās meklēt BIS. Pārbaudiet savienojumu.');
    } finally {
      setSpecialistLoading(false);
    }
  }, [token, specialistQuery]);

  // ─── Cache clear ────────────────────────────────────────────────────────

  const handleClearCache = useCallback(async () => {
    if (!token) return;
    setClearing(true);
    try {
      await bisClearCache(token);
      setCompanyResults([]);
      setSpecialistResults([]);
      setCompanySearched(false);
      setSpecialistSearched(false);
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="BIS Integrācija"
        description="Būvniecības informācijas sistēmas publisko reģistru meklēšana"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClearCache} disabled={clearing}>
              {clearing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              Notīrīt kešu
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://bis.gov.lv" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Atvērt BIS
              </a>
            </Button>
          </div>
        }
      />

      {/* Connection status banner */}
      {settings && (
        <div
          className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
            settings.enabled && settings.hasClientSecret
              ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
              : 'border-amber-100 bg-amber-50 text-amber-800'
          }`}
        >
          {settings.enabled && settings.hasClientSecret ? (
            <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          )}
          <div>
            {settings.enabled && settings.hasClientSecret ? (
              <>
                <span className="font-medium">BIS API savienojums aktīvs.</span> Meklēšana izmanto
                BIS OAuth2 API. Rezultāti tiek kešoti 24 stundas.
              </>
            ) : (
              <>
                <span className="font-medium">BIS API nav konfigurēts.</span> Meklēšana atgriež
                tiešās saites uz BIS portālu. Konfigurējiet akreditācijas datus cilnē{' '}
                <strong>Savienojums</strong>, lai aktivizētu tiešo API meklēšanu.
              </>
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">
            <Building2 className="h-4 w-4 mr-1.5" />
            Komersanti
          </TabsTrigger>
          <TabsTrigger value="specialists">
            <User className="h-4 w-4 mr-1.5" />
            Speciālisti
          </TabsTrigger>
          <TabsTrigger value="links">
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Ātrās saites
          </TabsTrigger>
          <TabsTrigger value="connection">
            <Settings2 className="h-4 w-4 mr-1.5" />
            Savienojums
          </TabsTrigger>
        </TabsList>

        {/* ─── Company search tab ─── */}
        <TabsContent value="companies" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Büvkomersantu reģistrs</CardTitle>
              <CardDescription className="text-xs">
                Meklējiet pēc uzņēmuma nosaukuma vai reģistrācijas numura (11 cipari). Rezultāti
                tiek ielādēti caur BIS serveri.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="company-q" className="sr-only">
                    Meklēšana
                  </Label>
                  <Input
                    id="company-q"
                    placeholder={'piem. SIA \u201cCe\u013cu b\u016bve\u201d vai 40003073671'}
                    value={companyQuery}
                    onChange={(e) => setCompanyQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCompanySearch()}
                  />
                </div>
                <Button
                  onClick={handleCompanySearch}
                  disabled={companyLoading || !companyQuery.trim()}
                >
                  {companyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-1.5">Meklēt</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {companyError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {companyError}
            </div>
          )}

          {companySearched && companyResults.length === 0 && (
            <div className="rounded-md border border-dashed px-6 py-10 text-center text-sm text-gray-400">
              Netika atrasts neviens komersants
            </div>
          )}

          {companyResults.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nosaukums</TableHead>
                      <TableHead>Reģ. nr.</TableHead>
                      <TableHead>BIS nr.</TableHead>
                      <TableHead>Klase</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead>Derīgs līdz</TableHead>
                      <TableHead className="text-right">BIS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyResults.map((company, idx) => (
                      <TableRow key={company.bisId || idx}>
                        <TableCell className="font-medium">{company.name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{company.regNr || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{company.bisNr || '—'}</TableCell>
                        <TableCell>
                          {company.classGroup ? (
                            <Badge variant="outline">{company.classGroup}</Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <CompanyStatusBadge status={company.status} />
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {company.validTo ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(company.validTo).toLocaleDateString('lv-LV')}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            href={company.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            Atvērt
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {companyResults.some(
                  (c) => c.status === 'NAV_PIESLĒGUMA' || c.status === 'NAV_DATU',
                ) && (
                  <div className="border-t px-4 py-2 text-xs text-gray-400">
                    BIS API nav konfigurēts — tiek rādīta tieša saite uz BIS portālu. Konfigurējiet
                    akreditācijas datus cilnē <strong>Savienojums</strong>.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Specialist search tab ─── */}
        <TabsContent value="specialists" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Būvspeciālistu reģistrs</CardTitle>
              <CardDescription className="text-xs">
                Meklējiet pēc speciālista vārda, uzvārda vai sertifikāta numura.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="specialist-q" className="sr-only">
                    Meklēšana
                  </Label>
                  <Input
                    id="specialist-q"
                    placeholder="piem. Jānis Bērziņš vai BS-12345"
                    value={specialistQuery}
                    onChange={(e) => setSpecialistQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSpecialistSearch()}
                  />
                </div>
                <Button
                  onClick={handleSpecialistSearch}
                  disabled={specialistLoading || !specialistQuery.trim()}
                >
                  {specialistLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-1.5">Meklēt</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {specialistError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {specialistError}
            </div>
          )}

          {specialistSearched && specialistResults.length === 0 && (
            <div className="rounded-md border border-dashed px-6 py-10 text-center text-sm text-gray-400">
              Netika atrasts neviens speciālists
            </div>
          )}

          {specialistResults.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vārds, Uzvārds</TableHead>
                      <TableHead>Sertifikāts</TableHead>
                      <TableHead>Darbība</TableHead>
                      <TableHead>Klase</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead>Derīgs līdz</TableHead>
                      <TableHead className="text-right">BIS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specialistResults.map((sp, idx) => (
                      <TableRow key={sp.bisId || idx}>
                        <TableCell className="font-medium">{sp.name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{sp.certNr || '—'}</TableCell>
                        <TableCell className="max-w-40 truncate text-xs text-gray-600">
                          {sp.activity || '—'}
                        </TableCell>
                        <TableCell>
                          {sp.classGroup ? <Badge variant="outline">{sp.classGroup}</Badge> : '—'}
                        </TableCell>
                        <TableCell>
                          <CompanyStatusBadge status={sp.status} />
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {sp.validTo ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(sp.validTo).toLocaleDateString('lv-LV')}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            href={sp.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            Atvērt
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {specialistResults.some(
                  (s) => s.status === 'NAV_PIESLĒGUMA' || s.status === 'NAV_DATU',
                ) && (
                  <div className="border-t px-4 py-2 text-xs text-gray-400">
                    BIS API nav konfigurēts — tiek rādīta tieša saite uz BIS portālu. Konfigurējiet
                    akreditācijas datus cilnē <strong>Savienojums</strong>.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Connection / settings tab ─── */}
        <TabsContent value="connection" className="mt-4 flex flex-col gap-4">
          {/* Status card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {settings?.enabled && settings?.hasClientSecret ? (
                  <>
                    <Wifi className="h-4 w-4 text-emerald-500" /> API savienojums
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-amber-500" /> API savienojums
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                BIS OAuth2 API konfigurācija. Akreditācijas datus iegūstiet, reģistrējoties BISP
                portālā vai sazinoties ar{' '}
                <a
                  href="mailto:Liene.Folkmane@bvkb.gov.lv"
                  className="text-blue-600 hover:underline"
                >
                  Liene.Folkmane@bvkb.gov.lv
                </a>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {settingsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Ielādē...
                </div>
              ) : (
                <>
                  {/* Enabled toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Integrācija iespējota</p>
                      <p className="text-xs text-gray-500">
                        Ja izslēgts, meklēšana atgriež tikai saites uz BIS portālu
                      </p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={setEnabled}
                      aria-label="BIS integrācija iespējota"
                    />
                  </div>

                  <Separator />

                  {/* Client ID */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bis-client-id">Client ID</Label>
                    <Input
                      id="bis-client-id"
                      placeholder="BIS OAuth2 client_id"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  {/* Client Secret */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bis-client-secret">
                      Client Secret
                      {settings?.hasClientSecret && (
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                          (saglabāts — atstājiet tukšu, lai nemainītu)
                        </span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        id="bis-client-secret"
                        type={showSecret ? 'text' : 'password'}
                        placeholder={
                          settings?.hasClientSecret ? '••••••••••••' : 'BIS OAuth2 client_secret'
                        }
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        autoComplete="new-password"
                        className="pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label={showSecret ? 'Slēpt' : 'Rādīt'}
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* API Base URL */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bis-api-base">API pamatadreses URL</Label>
                    <Input
                      id="bis-api-base"
                      placeholder="https://bis.gov.lv/bisp"
                      value={apiBaseUrl}
                      onChange={(e) => setApiBaseUrl(e.target.value)}
                    />
                    <p className="text-xs text-gray-400">
                      Standarta: <code>https://bis.gov.lv/bisp</code>. Mainiet tikai ja BVKB norāda
                      citu endpointu.
                    </p>
                  </div>

                  {/* Save result */}
                  {saveResult && (
                    <div
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        saveResult.ok
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {saveResult.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      {saveResult.message}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button onClick={handleSaveSettings} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                      Saglabāt
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={testing || (!settings?.hasClientSecret && !clientSecret)}
                    >
                      {testing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      ) : (
                        <Wifi className="h-4 w-4 mr-1.5" />
                      )}
                      Pārbaudīt savienojumu
                    </Button>
                  </div>

                  {/* Test result */}
                  {testResult && (
                    <div
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        testResult.ok
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {testResult.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      {testResult.message}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Registration info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Kā iegūt BIS API piekļuvi</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  Reģistrējiet uzņēmumu BISP portālā:{' '}
                  <a
                    href="https://bis.gov.lv/bisp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    bis.gov.lv/bisp
                  </a>
                </li>
                <li>Aizpildiet API pieteikumu sadaļā &quot;Datu apmaiņas saskarne&quot;</li>
                <li>
                  Saņemiet <code className="bg-gray-100 px-1 rounded">client_id</code> un{' '}
                  <code className="bg-gray-100 px-1 rounded">client_secret</code>
                </li>
                <li>Ievadiet akreditācijas datus zemāk un saglabājiet</li>
              </ol>
              <p className="text-xs text-gray-400 pt-1">
                Kontakts:{' '}
                <a href="mailto:Liene.Folkmane@bvkb.gov.lv" className="hover:underline">
                  Liene.Folkmane@bvkb.gov.lv
                </a>
                {' · '}
                <a
                  href="https://www.bvkb.gov.lv/lv/notikums/vebinars-bis-datu-apmainas-saskarnes-api-buvdarbu-veicejiem"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  API vebinārs
                </a>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Quick links tab ─── */}
        <TabsContent value="links" className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${link.color}`}
                >
                  <link.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight group-hover:text-blue-700">
                    {link.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 leading-snug">{link.description}</p>
                </div>
                <div className="mt-auto flex items-center gap-1 text-xs text-blue-600">
                  Atvērt BIS <ExternalLink className="h-3 w-3" />
                </div>
              </a>
            ))}
          </div>

          <Separator className="my-6" />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Par BIS</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>Būvniecības informācijas sistēma (BIS)</strong> ir Latvijas valsts pārvaldes
                informācijas sistēma, ko uztur{' '}
                <a
                  href="https://www.bvkb.gov.lv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Būvniecības valsts kontroles birojs (BVKB)
                </a>
                .
              </p>
              <p>
                BIS glabā informāciju par būvatļaujām, būvkomersantiem, būvspeciālistiem un citiem
                ar būvniecību saistītiem reģistriem. Publiskie reģistri ir pieejami bez
                autentifikācijas.
              </p>
              <p className="text-xs text-gray-400">
                Kontakts: BIS atbalsta dienests — tel. +371 62004010
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
