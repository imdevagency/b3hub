/**
 * WebWizardAuthGate
 *
 * Dialog shown when a guest tries to commit (select offer / send RFQ) in the
 * public /order wizard. Lets them:
 *   1. Register a quick BUYER account
 *   2. Log in to an existing account
 *
 * On success calls onAuthenticated(token) so the wizard can continue.
 * Airbnb pattern: show value first, gate only at commitment.
 */
'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginUser, registerUser, type User } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = 'choice' | 'register' | 'login';

interface Props {
  open: boolean;
  onAuthenticated: (user: User, token: string) => void;
  onDismiss: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WebWizardAuthGate({ open, onAuthenticated, onDismiss }: Props) {
  const [mode, setMode] = useState<Mode>('choice');

  // Register fields
  const [isCompany, setIsCompany] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setMode('choice');
    setError('');
    setIsCompany(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setCompanyName('');
    setRegNumber('');
    setPassword('');
    setLoginEmail('');
    setLoginPassword('');
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  async function handleRegister() {
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Ievadiet vārdu un uzvārdu.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Ievadiet derīgu e-pastu.');
      return;
    }
    if (password.length < 8) {
      setError('Parolei jābūt vismaz 8 rakstzīmēm.');
      return;
    }
    if (isCompany && !companyName.trim()) {
      setError('Ievadiet uzņēmuma nosaukumu.');
      return;
    }
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
        password,
        termsAccepted: true,
      });
      reset();
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reģistrācija neizdevās. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  }

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
                {[
                  { value: false, label: 'Privātpersona' },
                  { value: true, label: 'Uzņēmums' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setIsCompany(opt.value)}
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

              {isCompany && (
                <>
                  <Input
                    placeholder="Uzņēmuma nosaukums"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    autoComplete="organization"
                  />
                  <Input
                    placeholder="Reģistrācijas numurs (piem. 40003009497)"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    maxLength={12}
                  />
                </>
              )}

              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Parole (min. 8 rakstzīmes)"
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

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button onClick={handleRegister} disabled={loading} className="w-full rounded-xl">
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Izveidot kontu un pasūtīt
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
