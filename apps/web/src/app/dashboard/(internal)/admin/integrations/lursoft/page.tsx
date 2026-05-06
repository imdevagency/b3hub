'use client';

/**
 * /dashboard/admin/lursoft
 *
 * Lursoft Integrācija — Uzņēmumu rekvizītu pārbaude un meklēšana
 *
 * Lursoft IT aggreagate data directly from the Enterprise Register of the
 * Republic of Latvia plus court, insolvency, and tax-debt registries.
 *
 * Use cases on B3Hub:
 *  • Auto-fill at B2B registration — type reg.nr, get name/address/VAT instantly
 *  • Admin company verification — check insolvency, tax debts, liquidation status
 *  • Risk signals — warn if a buyer or seller company has active risk flags
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
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
  getLursoftSettings,
  updateLursoftSettings,
  lursoftTestConnection,
  lursoftSearchCompanies,
  lursoftClearCache,
  type LursoftCompany,
  type LursoftSettings,
  type UpdateLursoftSettingsDto,
} from '@/lib/api/lursoft';

// ─── Status helpers ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'NAV_PIESLĒGUMA') {
    return (
      <Badge variant="outline" className="text-gray-500">
        Nav savienojuma
      </Badge>
    );
  }
  const isActive = /aktīv|active|reģistr/i.test(status);
  if (isActive) {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3" />
        Aktīvs
      </Badge>
    );
  }
  if (/maksātnespēj|insolvenc/i.test(status)) {
    return (
      <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100">
        <ShieldAlert className="h-3 w-3" />
        Maksātnespēja
      </Badge>
    );
  }
  if (/likvid/i.test(status)) {
    return (
      <Badge className="gap-1 bg-orange-100 text-orange-700 hover:bg-orange-100">
        <AlertTriangle className="h-3 w-3" />
        Likvidācija
      </Badge>
    );
  }
  if (/izbeig|terminat/i.test(status)) {
    return (
      <Badge variant="outline" className="gap-1 text-gray-500">
        <XCircle className="h-3 w-3" />
        Izbeigts
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function RiskIndicators({ company }: { company: LursoftCompany }) {
  const flags = [
    company.hasInsolvency && { label: 'Maksātnespēja', color: 'bg-red-100 text-red-700' },
    company.hasLiquidation && { label: 'Likvidācija', color: 'bg-orange-100 text-orange-700' },
    company.hasTaxDebt && { label: 'Nodokļu parādi', color: 'bg-amber-100 text-amber-700' },
  ].filter(Boolean) as { label: string; color: string }[];

  if (flags.length === 0)
    return (
      <span className="text-xs text-emerald-600 flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" /> Nav risku
      </span>
    );

  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.color}`}>
          {f.label}
        </span>
      ))}
    </div>
  );
}

// ─── Company detail card ─────────────────────────────────────────────────────

function CompanyCard({ company }: { company: LursoftCompany }) {
  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{company.name}</CardTitle>
            <CardDescription className="mt-1">
              Reģ. Nr. {company.regNr}
              {company.vatNr && <> · PVN: {company.vatNr}</>}
              {company.legalForm && <> · {company.legalForm}</>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={company.status} />
            <a
              href={company.lursoftUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Adrese</p>
            <p>{company.address || '—'}</p>
          </div>
          {company.registeredAt && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                Reģistrēts
              </p>
              <p>{company.registeredAt}</p>
            </div>
          )}
          {company.nace && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">NACE</p>
              <p>
                {company.nace}
                {company.naceDescription && (
                  <span className="text-muted-foreground"> — {company.naceDescription}</span>
                )}
              </p>
            </div>
          )}
          {company.email && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">E-pasts</p>
              <p>{company.email}</p>
            </div>
          )}
        </div>

        <Separator />

        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">
            Riska signāli
          </p>
          <RiskIndicators company={company} />
        </div>

        {company.board.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">
                Valde / amatpersonas
              </p>
              <ul className="space-y-0.5">
                {company.board.map((member, i) => (
                  <li key={i} className="text-sm">
                    {member}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function LursoftPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  // Connection tab state
  const [settings, setSettings] = useState<LursoftSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.lursoft.lv');
  const [enabled, setEnabled] = useState(true);

  // Search tab state
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LursoftCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<LursoftCompany | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    if (!token) return;
    getLursoftSettings(token)
      .then((s) => {
        setSettings(s);
        setUsername(s.username);
        setBaseUrl(s.baseUrl);
        setEnabled(s.enabled);
      })
      .catch(() => setSaveMsg('Neizdevās ielādēt iestatījumus'))
      .finally(() => setSettingsLoading(false));
  }, [token]);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const dto: UpdateLursoftSettingsDto = { username, password, baseUrl, enabled };
      await updateLursoftSettings(dto, token);
      setSaveMsg('Saglabāts');
      setPassword('');
    } catch {
      setSaveMsg('Kļūda saglabājot');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }, [token, username, password, baseUrl, enabled]);

  const handleTest = useCallback(async () => {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await lursoftTestConnection(token);
      setTestResult(res);
    } catch {
      setTestResult({ ok: false, message: 'Savienojuma pārbaudes kļūda' });
    } finally {
      setTesting(false);
    }
  }, [token]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    setSelectedCompany(null);
    try {
      const results = await lursoftSearchCompanies(query, token);
      setSearchResults(results);
      if (results.length === 0) setSearchError('Nav atrasts neviens uzņēmums');
    } catch {
      setSearchError('Meklēšanas kļūda — pārbaudiet savienojumu');
    } finally {
      setSearching(false);
    }
  }, [query, token]);

  const handleClearCache = useCallback(async () => {
    if (!token) return;
    setClearingCache(true);
    try {
      await lursoftClearCache(token);
    } finally {
      setClearingCache(false);
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lursoft"
        description="Uzņēmumu rekvizītu pārbaude un automātiska meklēšana Latvijas uzņēmumu reģistrā"
      />

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Uzņēmumu meklēšana
          </TabsTrigger>
          <TabsTrigger value="connection">
            <Settings2 className="h-4 w-4 mr-2" />
            Savienojums
          </TabsTrigger>
        </TabsList>

        {/* ── Search tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="search" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Meklēt uzņēmumu
              </CardTitle>
              <CardDescription>
                Ievadiet uzņēmuma nosaukumu vai reģistrācijas numuru (piemēram:{' '}
                {'40003073671'})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="Uzņēmuma nosaukums vai reģ. Nr..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={searching || query.trim().length < 2}>
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Meklēt
                </Button>
              </div>

              {searchError && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                  <AlertCircle className="h-4 w-4" />
                  {searchError}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Search results table */}
          {searchResults.length > 0 && !selectedCompany && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Rezultāti ({searchResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nosaukums</TableHead>
                      <TableHead>Reģ. Nr.</TableHead>
                      <TableHead>Adrese</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead>Riski</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((c) => (
                      <TableRow
                        key={c.regNr}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedCompany(c)}
                      >
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{c.regNr}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-50 truncate">
                          {c.address || '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell>
                          <RiskIndicators company={c} />
                        </TableCell>
                        <TableCell>
                          <a
                            href={c.lursoftUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Selected company detail */}
          {selectedCompany && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCompany(null)}
                className="mb-2 text-muted-foreground"
              >
                ← Atpakaļ uz rezultātiem
              </Button>
              <CompanyCard company={selectedCompany} />
            </div>
          )}
        </TabsContent>

        {/* ── Connection tab ──────────────────────────────────────────────────── */}
        <TabsContent value="connection" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Credentials card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  Lursoft API akreditācija
                </CardTitle>
                <CardDescription>
                  HTTP Basic Auth — Lursoft konta lietotājvārds un parole. Iegūstiet
                  piekļuves datus, reģistrējoties kā API klients:{' '}
                  <a
                    href="https://lursoft.lv/lv/services/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    lursoft.lv/lv/services/api
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {settingsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ielādē...
                  </div>
                ) : (
                  <>
                    {/* Enabled toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">Integrācija aktīva</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Atslēdzot, Lursoft API netiks izsaukts
                        </p>
                      </div>
                      <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>

                    <Separator />

                    {/* Username */}
                    <div className="space-y-2">
                      <Label htmlFor="lursoft-username">Lietotājvārds (e-pasts)</Label>
                      <Input
                        id="lursoft-username"
                        type="email"
                        placeholder="piem. info@companija.lv"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="off"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="lursoft-password">
                        Parole
                        {settings?.hasPassword && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (saglabāta — ievadiet jaunu, lai mainītu)
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="lursoft-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder={settings?.hasPassword ? '••••••••' : 'Lursoft API parole'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Base URL */}
                    <div className="space-y-2">
                      <Label htmlFor="lursoft-base">API Base URL</Label>
                      <Input
                        id="lursoft-base"
                        type="url"
                        placeholder="https://api.lursoft.lv"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Noklusējuma vērtība: <code>https://api.lursoft.lv</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Saglabāt
                      </Button>
                      {saveMsg && (
                        <span className="text-sm text-muted-foreground">{saveMsg}</span>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Connection test + cache card */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {testResult == null ? (
                      <Wifi className="h-5 w-5 text-muted-foreground" />
                    ) : testResult.ok ? (
                      <Wifi className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-red-500" />
                    )}
                    Savienojuma pārbaude
                  </CardTitle>
                  <CardDescription>
                    Pieprasa reālu uzņēmumu datu no Lursoft API, lai pārbaudītu akreditāciju
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testing}
                    className="w-full"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Pārbaudīt savienojumu
                  </Button>

                  {testResult && (
                    <div
                      className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
                        testResult.ok
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {testResult.ok ? (
                        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      )}
                      {testResult.message}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-muted-foreground" />
                    Kešatmiņa
                  </CardTitle>
                  <CardDescription>
                    Uzņēmumu dati tiek kešoti 24 stundas. Notīriet, ja dati ir novecojuši.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className="w-full"
                  >
                    {clearingCache ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Notīrīt Lursoft kešatmiņu
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Par Lursoft integrāciju
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Lursoft IT apkopo datus tieši no{' '}
                    <strong className="text-foreground">Latvijas Uzņēmumu reģistra</strong>, kā
                    arī no tiesas, maksātnespējas un nodokļu parādu reģistriem.
                  </p>
                  <p>
                    B3Hub platformā Lursoft tiek izmantots:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Rekvizītu automātiska aizpilde B2B reģistrācijas laikā</li>
                    <li>Uzņēmumu verifikācija un riska pārbaude</li>
                    <li>Brīdinājumi par maksātnespēju vai nodokļu parādiem</li>
                  </ul>
                  <a
                    href="https://www.lursoft.lv/uploads/doc/API_service_1.3.68_en.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs mt-2"
                  >
                    API dokumentācija (v1.3.68)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
