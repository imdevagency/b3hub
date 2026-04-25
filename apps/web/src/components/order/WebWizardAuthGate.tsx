/**
 * WebWizardAuthGate
 *
 * Dialog shown when a guest tries to commit in the public /order wizard.
 * Three paths:
 *   1. Register — with Latvian-market specifics:
 *        • Privātpersona: includes Personas kods field
 *        • Uzņēmums: reg-number auto-lookup via UR open data API
 *        • Password is optional — if left blank we generate one and send
 *          a reset link so the user can set it later (guest-checkout UX)
 *   2. Login — email + password
 *
 * On success calls onAuthenticated(user, token) so the wizard can continue.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPassword, loginUser, registerUser, type User } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = 'choice' | 'register' | 'login';

interface UrLookupResult {
  found: boolean;
  name?: string;
  status?: string;
  address?: string;
}

interface Props {
  open: boolean;
  onAuthenticated: (user: User, token: string) => void;
  onDismiss: () => void;
  /** Pre-populate name + phone from the wizard's on-site contact fields. */
  prefilledName?: string;
  prefilledPhone?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a cryptographically random password (used when user skips password). */
function generateGuestPassword(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/[+/=]/g, '')
    .slice(0, 24);
}

// ── Component ────────────────────────────────────────────────────────────────

export function WebWizardAuthGate({
  open,
  onAuthenticated,
  onDismiss,
  prefilledName,
  prefilledPhone,
}: Props) {
  const [mode, setMode] = useState<Mode>('choice');

  // Register fields
  const [isCompany, setIsCompany] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Individual: personas kods
  const [personalCode, setPersonalCode] = useState('');
  // Company: reg lookup
  const [regNumber, setRegNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyNameLocked, setCompanyNameLocked] = useState(false);
  const [urLooking, setUrLooking] = useState(false);
  const [urResult, setUrResult] = useState<UrLookupResult | null>(null);
  const [urError, setUrError] = useState('');
  // Password (optional for guest checkout)
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  // T&C consent
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── UR lookup debounce ─────────────────────────────────────────────────────
  const urDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isCompany) return;
    const cleaned = regNumber.replace(/\s/g, '');
    if (!/^\d{8,12}$/.test(cleaned)) {
      setUrResult(null);
      setCompanyNameLocked(false);
      return;
    }

    if (urDebounce.current) clearTimeout(urDebounce.current);
    urDebounce.current = setTimeout(async () => {
      setUrLooking(true);
      setUrError('');
      try {
        const res = await fetch(`/api/company-lookup?regNumber=${encodeURIComponent(cleaned)}`);
        if (!res.ok) {
          setUrError('Uzņēmumu Reģistrs šobrīd nav pieejams — ievadiet nosaukumu manuāli');
          setUrResult(null);
          setCompanyNameLocked(false);
          return;
        }
        const data: UrLookupResult = await res.json();
        setUrResult(data);
        if (data.found && data.name) {
          // Block liquidated / struck-off companies
          const inactive = data.status && /likvidēt|izslēgt|beidz/i.test(data.status);
          if (inactive) {
            setUrError(`Uzņēmums "${data.name}" ir ${data.status} — reģistrācija nav iespējama`);
            setCompanyName('');
            setCompanyNameLocked(false);
          } else {
            setCompanyName(data.name);
            setCompanyNameLocked(true);
          }
        } else {
          setCompanyNameLocked(false);
        }
      } catch {
        setUrResult(null);
        setCompanyNameLocked(false);
      } finally {
        setUrLooking(false);
      }
    }, 600);

    return () => {
      if (urDebounce.current) clearTimeout(urDebounce.current);
    };
  }, [regNumber, isCompany]);

  // ── Pre-fill from wizard contact when gate opens ───────────────────────────
  useEffect(() => {
    if (!open) return;
    if (prefilledName) {
      const parts = prefilledName.trim().split(/\s+/);
      setFirstName((prev) => prev || parts[0] || '');
      setLastName((prev) => prev || parts.slice(1).join(' '));
    }
    if (prefilledPhone) {
      setPhone((prev) => prev || prefilledPhone);
    }
  }, [open, prefilledName, prefilledPhone]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    setMode('choice');
    setError('');
    setIsCompany(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPersonalCode('');
    setRegNumber('');
    setCompanyName('');
    setCompanyNameLocked(false);
    setUrResult(null);
    setUrError('');
    setPassword('');
    setTermsAccepted(false);
    setLoginEmail('');
    setLoginPassword('');
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  // ── Register ──────────────────────────────────────────────────────────────

  async function handleRegister() {
    setError('');
    if (!termsAccepted) {
      setError('Lūdzu piekrītiet lietošanas noteikumiem un privātuma politikai.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('Ievadiet vārdu un uzvārdu.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Ievadiet derīgu e-pastu.');
      return;
    }
    if (isCompany && !companyName.trim()) {
      setError('Ievadiet uzņēmuma nosaukumu.');
      return;
    }
    if (password && password.length < 8) {
      setError('Parolei jābūt vismaz 8 rakstzīmēm.');
      return;
    }

    // Guest checkout: generate a password silently; send reset link afterwards
    const isGuest = !password;
    const effectivePassword = password || generateGuestPassword();

    setLoading(true);
    try {
      const res = await registerUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        roles: ['BUYER'],
        isCompany,
        companyName: isCompany ? companyName.trim() : undefined,
        regNumber: isCompany && regNumber.trim() ? regNumber.trim() : undefined,
        personalCode: !isCompany && personalCode.trim() ? personalCode.trim() : undefined,
        password: effectivePassword,
        termsAccepted,
      });

      // If guest, fire a password-reset so they can set their own later
      if (isGuest) {
        forgotPassword(res.user.email).catch(() => {
          /* non-critical */
        });
      }

      reset();
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reģistrācija neizdevās. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async function handleLogin() {
    setError('');
    if (!loginEmail.trim() || !loginPassword) {
      setError('Ievadiet e-pastu un paroli.');
      return;
    }
    setLoading(true);
    try {
      const res = await loginUser({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      reset();
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pieteikšanās neizdevās. Pārbaudiet datus.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleDismiss} />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X className="size-4 text-gray-600" />
        </button>

        <div className="p-6 pt-8">
          {/* ── CHOICE ── */}
          {mode === 'choice' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Turpināt pasūtījumu</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Lai apstiprinātu pasūtījumu, lūdzu piesakieties vai izveidojiet kontu.
                </p>
              </div>
              <button
                onClick={() => setMode('register')}
                className="w-full flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-left hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-[15px] font-bold text-gray-900">Izveidot kontu</p>
                  <p className="text-sm text-gray-500">Ātri — tikai 30 sekundes</p>
                </div>
                <span className="text-xl text-gray-400">›</span>
              </button>
              <button
                onClick={() => setMode('login')}
                className="w-full flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-[15px] font-bold text-gray-900">Jau ir konts? Ieiet</p>
                  <p className="text-sm text-gray-500">Pieteikties ar e-pastu</p>
                </div>
                <span className="text-xl text-gray-400">›</span>
              </button>
              <p className="text-xs text-gray-400 text-center pt-1">
                Reģistrējoties jūs piekrītat{' '}
                <a href="/terms" target="_blank" className="underline">
                  lietošanas noteikumiem
                </a>{' '}
                un{' '}
                <a href="/privacy" target="_blank" className="underline">
                  privātuma politikai
                </a>
                .
              </p>
            </div>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setMode('choice');
                  setError('');
                }}
                className="text-sm text-gray-500 hover:text-gray-700 mb-1"
              >
                ← Atpakaļ
              </button>
              <h2 className="text-xl font-bold text-gray-900">Izveidot kontu</h2>

              {/* B2C / B2B toggle */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {(
                  [
                    { value: false, label: 'Privātpersona' },
                    { value: true, label: 'Uzņēmums' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => {
                      setIsCompany(opt.value);
                      setError('');
                    }}
                    className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                      isCompany === opt.value
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Vārds"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
                <Input
                  placeholder="Uzvārds"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>

              {/* Personas kods — individuals only */}
              {!isCompany && (
                <div className="space-y-1">
                  <Input
                    placeholder="Personas kods (piem. 010180-12345)"
                    value={personalCode}
                    onChange={(e) => setPersonalCode(e.target.value)}
                    autoComplete="off"
                    maxLength={12}
                  />
                  <p className="text-xs text-gray-400 pl-1">
                    Nepieciešams atkritumu pārvadāšanas dokumentiem
                  </p>
                </div>
              )}

              {/* Company fields */}
              {isCompany && (
                <div className="space-y-2">
                  {/* Reg number + UR lookup */}
                  <div className="relative">
                    <Input
                      placeholder="Reģistrācijas numurs (piem. 40003009497)"
                      value={regNumber}
                      onChange={(e) => {
                        setRegNumber(e.target.value);
                        setUrResult(null);
                        setCompanyNameLocked(false);
                      }}
                      maxLength={12}
                      className="pr-9"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {urLooking ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Search className="size-4" />
                      )}
                    </div>
                  </div>

                  {/* UR lookup feedback */}
                  {urError && <p className="text-xs pl-1 text-red-500">{urError}</p>}
                  {!urError && urResult && (
                    <p
                      className={`text-xs pl-1 ${urResult.found ? 'text-green-600' : 'text-amber-600'}`}
                    >
                      {urResult.found
                        ? `✓ ${urResult.name}${urResult.status ? ` · ${urResult.status}` : ''}`
                        : 'Nav atrasts Uzņēmumu Reģistrā — pārbaudiet numuru'}
                    </p>
                  )}

                  {/* Company name — read-only when filled from UR */}
                  <Input
                    placeholder="Uzņēmuma nosaukums"
                    value={companyName}
                    onChange={(e) => !companyNameLocked && setCompanyName(e.target.value)}
                    readOnly={companyNameLocked}
                    autoComplete="organization"
                    className={companyNameLocked ? 'bg-gray-50 text-gray-600 cursor-default' : ''}
                  />
                  {companyNameLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompanyNameLocked(false);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 pl-1 underline"
                    >
                      Labot manuāli
                    </button>
                  )}
                </div>
              )}

              {/* Contact */}
              <Input
                type="email"
                placeholder="E-pasts"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Input
                type="tel"
                placeholder="Tālrunis (neobligāts)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />

              {/* Password — optional */}
              <div className="space-y-1">
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Parole (neobligāts — nosūtīsim saiti)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {!password && (
                  <p className="text-xs text-gray-400 pl-1">
                    Ja atstājat tukšu — nosūtīsim e-pastu, lai iestatītu paroli vēlāk
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms-check"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-black cursor-pointer"
                />
                <label
                  htmlFor="terms-check"
                  className="text-xs text-gray-500 leading-relaxed cursor-pointer"
                >
                  Piekrītu{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    className="underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    lietošanas noteikumiem
                  </a>{' '}
                  un{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    className="underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    privātuma politikai
                  </a>
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                onClick={handleRegister}
                disabled={loading || !termsAccepted}
                className="w-full rounded-xl"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {password ? 'Izveidot kontu un pasūtīt' : 'Turpināt bez paroles'}
              </Button>
            </div>
          )}

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setMode('choice');
                  setError('');
                }}
                className="text-sm text-gray-500 hover:text-gray-700 mb-1"
              >
                ← Atpakaļ
              </button>
              <h2 className="text-xl font-bold text-gray-900">Ieiet</h2>

              <Input
                type="email"
                placeholder="E-pasts"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
              />
              <div className="relative">
                <Input
                  type={showLoginPw ? 'text' : 'password'}
                  placeholder="Parole"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLogin();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPw(!showLoginPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showLoginPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button onClick={handleLogin} disabled={loading} className="w-full rounded-xl">
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Ieiet un pasūtīt
              </Button>

              <a
                href="/forgot-password"
                className="block text-center text-sm text-gray-500 hover:text-gray-700 underline pt-1"
              >
                Aizmirsu paroli
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
