/**
 * Reset password page — /reset-password?token=...
 * Reads the reset token from the URL and sets a new password.
 */
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const valid = newPassword.length >= 8 && newPassword === confirm && token.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-red-600 mb-6">
          Nepareiza vai trūkstoša paroles atjaunošanas saite.
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" className="h-11">
            Mēģināt vēlreiz
          </Button>
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <ShieldCheck className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Parole atjaunota!</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Jūsu parole ir veiksmīgi atjaunota. Varat pieteikties ar jauno paroli.
        </p>
        <Button
          className="bg-red-600 hover:bg-red-700 text-white h-11 w-full"
          onClick={() => router.push('/login')}
        >
          Doties uz pieteikšanos
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Jauna parole</h1>
          <p className="text-sm text-muted-foreground">Ievadiet savu jauno paroli</p>
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
            Jaunā parole
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Vismaz 8 rakstzīmes"
              className="w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-red-500 mt-1">Parole jābūt vismaz 8 rakstzīmēm</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            Apstiprināt paroli
          </label>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Atkārtojiet paroli"
            className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
              mismatch ? 'border-red-400' : ''
            }`}
          />
          {mismatch && <p className="text-xs text-red-500 mt-1">Paroles nesakrīt</p>}
        </div>

        <Button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 text-white h-11"
          disabled={!valid || submitting}
        >
          {submitting ? 'Saglabā...' : 'Atjaunot paroli'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-gray-900 transition-colors"
        >
          Atpakaļ uz pieteikšanos
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-b from-red-50 to-white px-4 py-12">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Building2 className="h-8 w-8 text-red-600" />
        <span className="text-2xl font-bold text-gray-900">B3Hub</span>
      </Link>
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">
        <Suspense
          fallback={<div className="text-center py-8 text-sm text-gray-500">Ielādē...</div>}
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
