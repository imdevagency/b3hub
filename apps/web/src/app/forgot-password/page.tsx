/**
 * Forgot password page — /forgot-password
 * Submits email to /api/v1/auth/forgot-password to trigger a reset email.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft, Building2, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await forgotPassword(email.trim());
      setDone(true);
      if (res._devResetUrl) setDevUrl(res._devResetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-b from-red-50 to-white px-4 py-12">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Building2 className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold text-gray-900">B3Hub</span>
      </Link>

      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">
        {!done ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <Mail className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Atjaunot paroli</h1>
                <p className="text-sm text-muted-foreground">
                  Ievadiet e-pastu lai saņemtu atjaunošanas saiti
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  E-pasts
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="janis@uznemums.lv"
                  required
                  className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={submitting || !email.trim()}>
                {submitting ? 'Sūta...' : 'Nosūtīt atjaunošanas saiti'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Atpakaļ uz pieteikšanos
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Pārbaudiet savu e-pastu</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Ja konts ar šo e-pastu eksistē, mēs esam nosūtījuši paroles atjaunošanas saiti uz{' '}
              <strong>{email}</strong>.
            </p>

            {/* Dev-only helper — shows reset link without email service */}
            {devUrl && (
              <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-left">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                  Dev mode — reset link
                </p>
                <Link href={devUrl} className="text-sm text-blue-600 hover:underline break-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}
                  {devUrl}
                </Link>
              </div>
            )}

            <Link href="/login">
              <Button className="h-11 w-full">Atpakaļ uz pieteikšanos</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
