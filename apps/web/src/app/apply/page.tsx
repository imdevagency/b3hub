/**
 * Provider application page — /apply
 * Form for existing buyers to apply as a supplier or carrier.
 * Submits to /api/v1/provider-applications.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProviderApplication, type ProviderApplicationInput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Truck,
  Package,
  Building2,
  User,
  Phone,
  Mail,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface FormState {
  // Step 1: Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  // Step 2: Company
  companyName: string;
  regNumber: string;
  taxId: string;
  website: string;
  // Step 3: Capabilities
  appliesForSell: boolean;
  appliesForTransport: boolean;
  description: string;
}

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  companyName: '',
  regNumber: '',
  taxId: '',
  website: '',
  appliesForSell: false,
  appliesForTransport: false,
  description: '',
};

// ─────────────────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof FormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Validation per step ──────────────────────────────────────
  const step1Valid =
    form.firstName.trim() && form.lastName.trim() && form.email.trim() && form.phone.trim();
  const step2Valid = form.companyName.trim();
  const step3Valid = form.appliesForSell || form.appliesForTransport;

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: ProviderApplicationInput = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        companyName: form.companyName.trim(),
        regNumber: form.regNumber.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        website: form.website.trim() || undefined,
        appliesForSell: form.appliesForSell,
        appliesForTransport: form.appliesForTransport,
        description: form.description.trim() || undefined,
      };
      await createProviderApplication(payload);
      setStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Neizdevās nosūtīt pieteikumu');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-white flex flex-col">
      {/* Nav */}
      <header className="border-b bg-white/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-extrabold text-xl tracking-tight text-gray-900"
        >
          <span className="text-red-600">B3</span>Hub
        </Link>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-gray-900 transition-colors"
        >
          Jau ir konts? Ieiet →
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Progress indicator */}
          {step < 4 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                {([1, 2, 3] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                        s < step
                          ? 'bg-red-600 text-white'
                          : s === step
                            ? 'bg-red-100 text-red-700 border-2 border-red-600'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {s < step ? <CheckCircle className="h-4 w-4" /> : s}
                    </div>
                    {s < 3 && (
                      <div className={`flex-1 h-0.5 ${s < step ? 'bg-red-600' : 'bg-gray-200'}`} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {step === 1 && 'Kontaktinformācija'}
                {step === 2 && 'Uzņēmuma dati'}
                {step === 3 && 'Pakalpojumi'}
              </p>
            </div>
          )}

          {/* Card */}
          <div className="bg-white border rounded-2xl shadow-sm p-8">
            {/* ── Step 1: Contact ─────────────────────────────── */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <User className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Kļūsti par piegādātāju</h1>
                    <p className="text-sm text-muted-foreground">Ievadiet kontaktinformāciju</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Vārds *
                      </label>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => set('firstName', e.target.value)}
                        placeholder="Jānis"
                        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Uzvārds *
                      </label>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => set('lastName', e.target.value)}
                        placeholder="Bērziņš"
                        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      <Mail className="inline h-3.5 w-3.5 mr-1" />
                      E-pasts *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="janis@uznemums.lv"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      <Phone className="inline h-3.5 w-3.5 mr-1" />
                      Tālrunis *
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder="+371 20 000 000"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <Button
                  className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white h-11"
                  onClick={() => setStep(2)}
                  disabled={!step1Valid}
                >
                  Turpināt
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}

            {/* ── Step 2: Company ─────────────────────────────── */}
            {step === 2 && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Uzņēmuma dati</h1>
                    <p className="text-sm text-muted-foreground">Juridiskā informācija</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Uzņēmuma nosaukums *
                    </label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => set('companyName', e.target.value)}
                      placeholder="SIA Mans Uzņēmums"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Reģ. numurs
                      </label>
                      <input
                        type="text"
                        value={form.regNumber}
                        onChange={(e) => set('regNumber', e.target.value)}
                        placeholder="40000000000"
                        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        PVN numurs
                      </label>
                      <input
                        type="text"
                        value={form.taxId}
                        onChange={(e) => set('taxId', e.target.value)}
                        placeholder="LV40000000000"
                        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Mājaslapa
                    </label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => set('website', e.target.value)}
                      placeholder="https://manuznemums.lv"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Atpakaļ
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white h-11"
                    onClick={() => setStep(3)}
                    disabled={!step2Valid}
                  >
                    Turpināt
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ── Step 3: Capabilities ────────────────────────── */}
            {step === 3 && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <Package className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Pakalpojumi</h1>
                    <p className="text-sm text-muted-foreground">Ko vēlaties piedāvāt?</p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <button
                    type="button"
                    onClick={() => set('appliesForSell', !form.appliesForSell)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      form.appliesForSell
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${form.appliesForSell ? 'bg-red-600' : 'bg-gray-100'}`}
                    >
                      <Package
                        className={`h-5 w-5 ${form.appliesForSell ? 'text-white' : 'text-gray-400'}`}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">Materiālu pārdošana</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Smilts, grants, dolomīts, betona izstrādājumi u.c.
                      </p>
                    </div>
                    <div
                      className={`ml-auto w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${form.appliesForSell ? 'border-red-600 bg-red-600' : 'border-gray-300'}`}
                    >
                      {form.appliesForSell && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => set('appliesForTransport', !form.appliesForTransport)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      form.appliesForTransport
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${form.appliesForTransport ? 'bg-red-600' : 'bg-gray-100'}`}
                    >
                      <Truck
                        className={`h-5 w-5 ${form.appliesForTransport ? 'text-white' : 'text-gray-400'}`}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">Transporta pakalpojumi</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Piegāde, kravas transportēšana, konteineru apkalpošana
                      </p>
                    </div>
                    <div
                      className={`ml-auto w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${form.appliesForTransport ? 'border-red-600 bg-red-600' : 'border-gray-300'}`}
                    >
                      {form.appliesForTransport && (
                        <CheckCircle className="h-3.5 w-3.5 text-white" />
                      )}
                    </div>
                  </button>
                </div>

                {!step3Valid && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                    Lūdzu izvēlieties vismaz vienu pakalpojumu veidu.
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Papildinformācija (pēc izvēles)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Pastāstiet par savu uzņēmumu, floti, kapacitāti..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(2)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Atpakaļ
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white h-11"
                    onClick={handleSubmit}
                    disabled={!step3Valid || submitting}
                  >
                    {submitting ? 'Sūta...' : 'Iesniegt pieteikumu'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Step 4: Success ─────────────────────────────── */}
            {step === 4 && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
                  Pieteikums iesniegts!
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Paldies, <strong>{form.firstName}</strong>! Mēs izskatīsim Jūsu pieteikumu tuvāko
                  darba dienu laikā un sazināsimies ar Jums uz <strong>{form.email}</strong>.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="outline" className="h-11" onClick={() => router.push('/login')}>
                    Ieiet sistēmā
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white h-11"
                    onClick={() => router.push('/')}
                  >
                    Uz sākumlapu
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
