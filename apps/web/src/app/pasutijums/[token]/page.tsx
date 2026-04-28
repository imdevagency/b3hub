'use client';

/**
 * Public guest order tracking page — /pasutijums/[token]
 * No authentication required. Shows order status and details.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  claimGuestOrder,
  getGuestOrderByToken,
  type GuestOrderTracking,
} from '@/lib/api/guest-orders';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Saņemts — apstrādē',
  CONTACTED: 'Sazinājāmies ar jums',
  CONVERTED: 'Pasūtījums apstiprināts',
  CANCELLED: 'Atcelts',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONTACTED: 'bg-blue-100 text-blue-800',
  CONVERTED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const STATUS_STEPS = ['PENDING', 'CONTACTED', 'CONVERTED'] as const;
const STATUS_STEP_LABEL: Record<string, string> = {
  PENDING: 'Saņemts',
  CONTACTED: 'Sazinājāmies',
  CONVERTED: 'Apstiprināts',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuestOrderTrackingPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const router = useRouter();
  const { setAuth, user: authUser } = useAuth();

  const [order, setOrder] = useState<GuestOrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Claim form state ──────────────────────────────────────────────────────
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimDone, setClaimDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getGuestOrderByToken(token)
      .then(setOrder)
      .catch(() => setError('Pasūtījums nav atrasts vai saite ir nederīga.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleClaim() {
    setClaimError('');
    if (!/^\S+@\S+\.\S+$/.test(claimEmail.trim())) {
      setClaimError('Ievadiet derīgu e-pastu.');
      return;
    }
    if (claimPassword.length < 8) {
      setClaimError('Parolei jābūt vismaz 8 rakstzīmēm.');
      return;
    }
    setClaiming(true);
    try {
      const res = await claimGuestOrder(token, {
        email: claimEmail.trim().toLowerCase(),
        password: claimPassword,
      });
      setAuth(res.user, res.token);
      setClaimDone(true);
      // Brief success flash, then forward to dashboard
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Konta izveide neizdevās.';
      // Friendlier message for the most common case
      setClaimError(
        /already exists/i.test(msg) ? 'Šāds e-pasts jau ir reģistrēts. Lūdzu pieslēdzieties.' : msg,
      );
    } finally {
      setClaiming(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-start justify-center pt-16 px-4">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Pasūtījums nav atrasts</h1>
          <p className="text-gray-500 text-sm mb-6">
            {error || 'Pārbaudiet saiti vai sazinieties ar mums.'}
          </p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/">Doties uz sākumlapu</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentStepIndex =
    order.status === 'CANCELLED'
      ? -1
      : STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">B3Hub</p>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-0.5">
              Pasūtījuma izsekošana
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">#{order.orderNumber}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-700'}`}
          >
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        {/* Progress steps */}
        {order.status !== 'CANCELLED' && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center">
                {STATUS_STEPS.map((step, idx) => {
                  const done = idx <= currentStepIndex;
                  const active = idx === currentStepIndex;
                  return (
                    <div key={step} className="flex-1 flex items-center">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                            done ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {done && !active ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                        </div>
                        <p
                          className={`mt-2 text-[11px] font-semibold text-center ${active ? 'text-gray-900' : done ? 'text-gray-600' : 'text-gray-400'}`}
                        >
                          {STATUS_STEP_LABEL[step]}
                        </p>
                      </div>
                      {idx < STATUS_STEPS.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-1 mb-5 ${idx < currentStepIndex ? 'bg-gray-900' : 'bg-gray-200'}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancelled banner */}
        {order.status === 'CANCELLED' && (
          <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Šis pasūtījums ir atcelts. Ja tas noticis kļūdas dēļ, sazinieties ar mums.
            </p>
          </div>
        )}

        {/* Order details */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              Pasūtījuma detaļas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Materiāls</span>
              <span className="font-semibold text-right">{order.materialName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Daudzums</span>
              <span className="font-semibold">
                {order.quantity} {order.unit}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Piegādes adrese</span>
              <span className="font-semibold text-right">
                {order.deliveryAddress}, {order.deliveryCity}
              </span>
            </div>
            {order.deliveryDate && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Piegādes datums</span>
                <span className="font-semibold">
                  {formatDate(order.deliveryDate)}
                  {order.deliveryWindow ? ` · ${order.deliveryWindow}` : ''}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pasūtītājs</span>
              <span className="font-semibold">{order.contactName}</span>
            </div>
          </CardContent>
        </Card>

        {/* Contact / next steps */}
        <Card className="rounded-2xl border-0 shadow-sm bg-gray-900 text-white">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-semibold">Jautājumi?</p>
            </div>
            <p className="text-sm text-gray-300">
              Sazinieties ar mums pa e-pastu vai tālruni — mēs atbildēsim darba dienās.
            </p>
            <a
              href="mailto:info@b3hub.lv"
              className="inline-block text-sm font-bold text-white underline underline-offset-2"
            >
              info@b3hub.lv
            </a>
          </CardContent>
        </Card>

        {/* CTA — claim this order with a real account */}
        {authUser ? (
          <div className="text-center pt-2">
            <p className="text-sm text-gray-500 mb-3">
              Skatiet visus savus pasūtījumus kontrolpanelī.
            </p>
            <Button asChild className="rounded-xl gap-2">
              <Link href="/dashboard">
                Uz kontrolpaneli <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : claimDone ? (
          <Card className="rounded-2xl border-0 shadow-sm bg-green-50">
            <CardContent className="pt-5 pb-5 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
              <p className="text-sm font-bold text-green-900 mb-1">Konts izveidots!</p>
              <p className="text-sm text-green-700">Pārvietojam uz kontrolpaneli…</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-0 shadow-sm bg-white">
            <CardContent className="pt-5 pb-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gray-700" />
                <p className="text-sm font-bold text-gray-900">Saglabājiet šo pasūtījumu</p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Izveidojiet kontu, lai sekotu pasūtījumiem, saglabātu adreses un nākamreiz pasūtītu
                ar vienu klikšķi. Mēs jau zinām jūsu vārdu un tālruni — vajag tikai e-pastu un
                paroli.
              </p>

              <Input
                type="email"
                placeholder="E-pasts"
                value={claimEmail}
                onChange={(e) => setClaimEmail(e.target.value)}
                autoComplete="email"
                className="rounded-xl"
              />
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Parole (vismaz 8 rakstzīmes)"
                  value={claimPassword}
                  onChange={(e) => setClaimPassword(e.target.value)}
                  autoComplete="new-password"
                  className="rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPw ? 'Slēpt paroli' : 'Rādīt paroli'}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {claimError && <p className="text-sm text-red-600">{claimError}</p>}

              <Button
                onClick={handleClaim}
                disabled={claiming || !claimEmail || !claimPassword}
                className="w-full rounded-xl gap-2"
              >
                {claiming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Izveidot kontu
              </Button>

              <p className="text-[11px] text-gray-400 text-center pt-1">
                Reģistrējoties piekrītat{' '}
                <a href="/terms" target="_blank" className="underline">
                  noteikumiem
                </a>{' '}
                un{' '}
                <a href="/privacy" target="_blank" className="underline">
                  privātuma politikai
                </a>
                .{' '}
                <Link href="/login" className="underline font-semibold">
                  Jau ir konts? Ieiet
                </Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
