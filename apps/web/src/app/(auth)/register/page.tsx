/**
 * Register page — /register
 * New account form supporting buyer, supplier, and carrier role selection.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Building2, HardHat, Loader2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

const ACCOUNT_KIND_META = [
  { value: true, label: 'Uzņēmums' },
  { value: false, label: 'Privātpersona' },
];

const schema = z
  .object({
    firstName: z.string().min(2, 'Vārdam jābūt vismaz 2 rakstzīmēm'),
    lastName: z.string().min(2, 'Uzvārdam jābūt vismaz 2 rakstzīmēm'),
    email: z.string().email('Lūdzu ievadiet derīgu e-pastu'),
    phone: z.string().optional(),
    userType: z.enum(['BUYER', 'SUPPLIER', 'CARRIER'] as const),
    isCompany: z.boolean().optional(),
    password: z.string().min(8, 'Parolei jābūt vismaz 8 rakstzīmēm'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Paroles nesakrīt',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      userType: 'BUYER',
      isCompany: true,
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched', // Important for validation without submitting the whole form
  });

  const nextStep = async (fieldsToValidate: (keyof FormData)[]) => {
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const { confirmPassword: _, userType, ...rest } = data;
      const payload = {
        ...rest,
        roles: [userType],
        termsAccepted: true,
      };
      const res = await registerUser(payload);
      setAuth(res.user, res.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reģistrācija neizdevās');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Absolute Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <a href={process.env.NEXT_PUBLIC_LANDING_URL || 'https://b3hub.lv'} className="text-black text-2xl font-bold tracking-tight">
          B3Hub
        </a>
        <Link
          href="/login"
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* --- STEP 1 --- */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="mb-8">
                    <h1 className="text-4xl font-medium text-gray-900 tracking-tight mb-3">
                      Sāksim ar e-pastu
                    </h1>
                    <p className="text-[15px] text-gray-500">
                      Ievadiet e-pastu un tālruni, lai izveidotu kontu.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 mb-4">
                      {error}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="E-pasts (piem., janis@uznemums.lv)"
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
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="Tālrunis (nav obligāti)"
                            className="h-13 px-4 text-[15px] bg-gray-100 border-transparent hover:bg-gray-200 focus:bg-white focus:border-black focus:ring-black focus:ring-2 rounded-xl transition-all placeholder:text-gray-500"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    onClick={() => nextStep(['email', 'phone'])}
                    className="w-full h-13 bg-black hover:bg-gray-800 text-white rounded-xl text-[15px] font-medium mt-2 transition-colors"
                  >
                    Turpināt
                  </Button>
                </div>
              )}

              {/* --- STEP 2 --- */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="mb-8">
                    <h1 className="text-4xl font-medium text-gray-900 tracking-tight mb-3">
                      Kā izmantosiet B3Hub?
                    </h1>
                    <p className="text-[15px] text-gray-500">
                      Izvēlieties savu galveno lomu platformā.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="userType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        {USER_TYPE_META.map((type) => {
                          const Icon = type.icon;
                          const isSelected = field.value === type.value;
                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => field.onChange(type.value)}
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
                              <div>
                                <h3
                                  className={`text-[15px] font-medium ${isSelected ? 'text-black' : 'text-gray-900'}`}
                                >
                                  {type.label}
                                </h3>
                                <p className="text-[13px] text-gray-500 mt-0.5">
                                  {type.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Company Toggle for Buyer */}
                  {form.watch('userType') === 'BUYER' && (
                    <FormField
                      control={form.control}
                      name="isCompany"
                      render={({ field }) => (
                        <FormItem className="mt-6 pt-6 animate-in fade-in duration-300">
                          <div className="flex gap-3">
                            {ACCOUNT_KIND_META.map((kind) => (
                              <button
                                key={String(kind.value)}
                                type="button"
                                onClick={() => field.onChange(kind.value)}
                                className={`flex-1 py-3 px-4 rounded-xl text-[14px] font-medium transition-all ${
                                  field.value === kind.value
                                    ? 'bg-black text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {kind.label}
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button
                    type="button"
                    onClick={() => nextStep(['userType', 'isCompany'])}
                    className="w-full h-13 bg-black hover:bg-gray-800 text-white rounded-xl text-[15px] font-medium mt-6 transition-colors"
                  >
                    Turpināt
                  </Button>
                </div>
              )}

              {/* --- STEP 3 --- */}
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

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="Vārds"
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
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="Uzvārds"
                              className="h-13 px-4 text-[15px] bg-gray-100 border-transparent hover:bg-gray-200 focus:bg-white focus:border-black focus:ring-black focus:ring-2 rounded-xl transition-all placeholder:text-gray-500"
                              {...field}
                            />
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
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Atkārtojiet paroli"
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
                    Noklikšķinot "Pabeigt reģistrāciju", piekrītat mūsu{' '}
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
