/**
 * Register page — /register
 * New account form: Step 1 = account type + contact, Step 2 = role, Step 3 = name + password.
 */
'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Building2, HardHat, Loader2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { registerUser, RegistrationRole } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const USER_TYPE_META: {
  value: RegistrationRole;
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    value: 'BUYER',
    label: 'Pasūtītājs',
    description: 'Pasūtīt materiālus un piegādes',
    icon: HardHat,
  },
  {
    value: 'SUPPLIER',
    label: 'Pārdevējs',
    description: 'Uzskaitīt un pārdot materiālus',
    icon: Building2,
  },
  {
    value: 'CARRIER',
    label: 'Pārvadātājs',
    description: 'Transportēt materiālus',
    icon: Truck,
  },
];

const schema = z
  .object({
    firstName: z.string().min(2, 'Vārdam jābūt vismaz 2 rakstzīmēm'),
    lastName: z.string().min(2, 'Uzvārdam jābūt vismaz 2 rakstzīmēm'),
    email: z.string().email('Lūdzu ievadiet derīgu e-pastu'),
    phone: z.string().optional(),
    companyName: z.string().min(2, 'Uzņēmuma nosaukums ir obligāts'),
    regNumber: z.string().optional(),
    password: z.string().min(8, 'Parolei jābūt vismaz 8 rakstzīmēm'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Paroles nesakrīt',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const inputCls =
  'h-13 px-4 text-[15px] bg-gray-100 border-transparent hover:bg-gray-200 focus:bg-white focus:border-black focus:ring-black focus:ring-2 rounded-xl transition-all placeholder:text-gray-500';

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Map landing-page role params to initial selection
  const ROLE_PARAM_MAP: Record<string, RegistrationRole> = {
    driver: 'CARRIER',
    carrier: 'CARRIER',
    seller: 'SUPPLIER',
    supplier: 'SUPPLIER',
    buyer: 'BUYER',
  };
  const roleParam = searchParams.get('role')?.toLowerCase() ?? '';
  const initialRole: RegistrationRole = ROLE_PARAM_MAP[roleParam] ?? 'BUYER';

  const [selectedRoles, setSelectedRoles] = useState<Set<RegistrationRole>>(new Set([initialRole]));
  const [rolesError, setRolesError] = useState<string | null>(null);

  // Where to land after successful registration (middleware sets this)
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      companyName: '',
      regNumber: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const nextStep = async (fieldsToValidate: (keyof FormData)[]) => {
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const { confirmPassword: _, companyName, regNumber, ...rest } = data;
      const res = await registerUser({
        ...rest,
        roles: Array.from(selectedRoles),
        isCompany: true,
        companyName: companyName?.trim() || undefined,
        regNumber: regNumber?.trim() || undefined,
        termsAccepted: true,
      });
      setAuth(res.user, res.token, res.refreshToken);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reģistrācija neizdevās');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Absolute Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <a href="/" className="text-black text-2xl font-bold tracking-tight">
          Bilt
        </a>
        <Link
          href={
            redirectTo !== '/dashboard'
              ? `/login?redirect=${encodeURIComponent(redirectTo)}`
              : '/login'
          }
          className="text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors px-5 py-2.5 rounded-full"
        >
          Ieiet
        </Link>
      </div>

      {/* Main Content Centered */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-20 lg:py-0 w-full">
        <div className="w-full max-w-100">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="mb-8 flex items-center text-sm font-medium text-gray-500 hover:text-black transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Atpakaļ
            </button>
          )}

          <Form {...form}>
            <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* ── STEP 1 — Account type + contact ── */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-8">
                    <h1 className="text-4xl font-medium text-gray-900 tracking-tight mb-3">
                      Reģistrēt uzņēmumu
                    </h1>
                    <p className="text-[15px] text-gray-500">
                      Bilt ir pieejams tikai reģistrētiem uzņēmumiem.
                    </p>
                  </div>

                  {/* Company fields */}
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="Uzņēmuma nosaukums"
                              autoCapitalize="words"
                              maxLength={100}
                              className={inputCls}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="regNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="Reģistrācijas numurs (piem. 40003009497)"
                              inputMode="numeric"
                              maxLength={12}
                              className={inputCls}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="E-pasts (piem., janis@uznemums.lv)"
                            className={inputCls}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="Tālrunis (nav obligāti)"
                            className={inputCls}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    onClick={() => nextStep(['companyName', 'email', 'phone'])}
                    className="w-full h-13 bg-black hover:bg-gray-800 text-white rounded-xl text-[15px] font-medium mt-2 transition-colors"
                  >
                    Turpināt
                  </Button>
                </div>
              )}

              {/* ── STEP 2 — Role ── */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="mb-8">
                    <h1 className="text-4xl font-medium text-gray-900 tracking-tight mb-3">
                      Kā izmantosiet Bilt?
                    </h1>
                    <p className="text-[15px] text-gray-500">
                      Izvēlieties vienu vai vairākas lomas — var mainīt vēlāk.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {USER_TYPE_META.map((type) => {
                      const Icon = type.icon;
                      const isSelected = selectedRoles.has(type.value);
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            setRolesError(null);
                            setSelectedRoles((prev) => {
                              const next = new Set(prev);
                              if (next.has(type.value)) next.delete(type.value);
                              else next.add(type.value);
                              return next;
                            });
                          }}
                          className={`w-full flex items-center p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-black bg-[#f8f8f8]'
                              : 'border-transparent bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          <div
                            className={`p-3 rounded-full mr-4 transition-colors ${isSelected ? 'bg-black text-white' : 'bg-white text-gray-600 shadow-sm'}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h3
                              className={`text-[15px] font-medium ${isSelected ? 'text-black' : 'text-gray-900'}`}
                            >
                              {type.label}
                            </h3>
                            <p className="text-[13px] text-gray-500 mt-0.5">{type.description}</p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-black border-black' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && (
                              <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white">
                                <path
                                  d="M1 4l3 3 5-6"
                                  stroke="white"
                                  strokeWidth="1.5"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {rolesError && (
                      <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {rolesError}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      if (selectedRoles.size === 0) {
                        setRolesError('Izvēlieties vismaz vienu lomu');
                        return;
                      }
                      setStep(3);
                    }}
                    className="w-full h-13 bg-black hover:bg-gray-800 text-white rounded-xl text-[15px] font-medium mt-6 transition-colors"
                  >
                    Turpināt
                  </Button>
                </div>
              )}

              {/* ── STEP 3 — Name + password ── */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="mb-6">
                    <h1 className="text-4xl font-medium text-gray-900 tracking-tight mb-3">
                      Pēdējais solis
                    </h1>
                    <p className="text-[15px] text-gray-500">
                      Ievadiet savu vārdu un izveidojiet paroli.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 mb-4">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Vārds" className={inputCls} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Uzvārds" className={inputCls} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Parole (min. 8 rakstzīmes)"
                            className={inputCls}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Atkārtojiet paroli"
                            className={inputCls}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-13 bg-black hover:bg-gray-800 text-white rounded-xl text-[15px] font-medium mt-6 transition-colors shadow-none"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Izveido kontu…
                      </>
                    ) : (
                      'Pabeigt reģistrāciju'
                    )}
                  </Button>

                  <p className="text-center text-[13px] text-gray-500 mt-6 pt-4 border-t border-gray-100 leading-relaxed">
                    Noklikšķinot &ldquo;Pabeigt reģistrāciju&rdquo;, piekrītat mūsu{' '}
                    <Link href="/terms" className="underline hover:text-black">
                      Noteikumiem
                    </Link>{' '}
                    un{' '}
                    <Link href="/privacy" className="underline hover:text-black">
                      Privātuma politikai
                    </Link>
                    .
                  </p>
                </div>
              )}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageInner />
    </Suspense>
  );
}
