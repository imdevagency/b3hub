/**
 * Login page — /login
 * Email + password form, calls /api/v1/auth/login and stores JWT in auth context.
 */
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { loginUser } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const IS_ADMIN_APP = process.env.NEXT_PUBLIC_APP_MODE === 'admin';

const schema = z.object({
  email: z.string().email('Lūdzu ievadiet derīgu e-pastu'),
  password: z.string().min(1, 'Parole ir nepieciešana'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, user, token, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Tracks whether the form has been submitted so the auto-redirect
  // useEffect below doesn't double-navigate after setAuth updates user/token.
  const hasSubmitted = useRef(false);

  // Where to land after successful login.
  // Admin app always lands on /dashboard/group; marketplace uses redirect param.
  const redirectTo = IS_ADMIN_APP
    ? '/dashboard/group'
    : searchParams.get('redirect') || '/dashboard';

  // If the user arrives on the login page with an existing valid session (e.g.
  // cookie expired but localStorage token is still good), re-sync the middleware
  // cookie and bounce them home. The hasSubmitted guard prevents this from firing
  // after a just-completed form submission (which already calls router.push).
  useEffect(() => {
    if (isLoading || !user || !token) return;
    if (hasSubmitted.current) return;
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .catch(() => null)
      .finally(() => router.replace(redirectTo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, token]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    hasSubmitted.current = true;
    try {
      const res = await loginUser(data);
      // Set the HttpOnly cookie BEFORE navigating so the middleware
      // recognises the session on the very first /dashboard request.
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: res.token }),
      }).catch(() => null);
      setAuth(res.user, res.token, res.refreshToken);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pieteikšanās neizdevās');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Absolute Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <a href="/" className="text-black text-2xl font-bold tracking-tight">
          B3Hub{IS_ADMIN_APP ? ' Admin' : ''}
        </a>
        {!IS_ADMIN_APP && (
          <Link
            href={
              redirectTo !== '/dashboard'
                ? `/register?redirect=${encodeURIComponent(redirectTo)}`
                : '/register'
            }
            className="text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors px-5 py-2.5 rounded-full"
          >
            Reģistrēties
          </Link>
        )}
      </div>

      {/* Main Content Centered */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-20 lg:py-0 w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="w-full max-w-100">
          <div className="mb-8">
            <h1 className="text-4xl font-medium text-gray-900 tracking-tight mb-3">
              Laipni atgriezties
            </h1>
            <p className="text-[15px] text-gray-500">Ievadiet savus datus, lai piekļūtu kontam.</p>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 mb-6">
              {error}
            </div>
          )}

          <Form {...form}>
            <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="E-pasts"
                        className="h-13 px-4 text-[15px] bg-gray-100 border-transparent hover:bg-gray-200 focus:bg-white focus:border-black focus:ring-black focus:ring-2 rounded-xl transition-all placeholder:text-gray-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Parole"
                        className="h-13 px-4 text-[15px] bg-gray-100 border-transparent hover:bg-gray-200 focus:bg-white focus:border-black focus:ring-black focus:ring-2 rounded-xl transition-all placeholder:text-gray-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-13 bg-black hover:bg-gray-800 text-white rounded-xl text-[15px] font-medium mt-4 transition-colors shadow-none"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Pieteikšanās…
                  </>
                ) : (
                  'Turpināt'
                )}
              </Button>

              {!IS_ADMIN_APP && (
                <div className="text-center mt-6 pt-4">
                  <Link
                    href="/forgot-password"
                    className="text-[14px] text-gray-500 hover:text-black font-medium transition-colors"
                  >
                    Aizmirsāt paroli?
                  </Link>
                </div>
              )}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
