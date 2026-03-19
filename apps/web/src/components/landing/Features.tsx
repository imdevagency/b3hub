/**
 * Features landing section.
 * Grid of platform feature cards (materials marketplace, transport, skip-hire, etc.).
 */
import { ShoppingCart, Users, Package, BarChart3, Shield, Zap } from 'lucide-react';

const features = [
  {
    name: 'Materiālu Pārvaldība',
    description:
      'Efektīvi pārvaldiet materiālu krājumus ar reāllaika izsekošanu, kategorizēšanu un pieejamības statusu.',
    icon: Package,
  },
  {
    name: 'Pasūtījumu Apstrāde',
    description:
      'Optimizējiet pasūtījumu darba plūsmas no izveides līdz piegādei. Izsekojiet statusam, pārvaldiet izpildi un informējiet klientus.',
    icon: ShoppingCart,
  },
  {
    name: 'Vairāku Lietotāju Atbalsts',
    description:
      'Lomu atbilstošā piekļuve piegādātājiem, klientiem un vadītājiem. Katrs lietotāja veids saņem pielāgotas funkcijas un atļaujas.',
    icon: Users,
  },
  {
    name: 'Reāllaika Analītika',
    description: 'Gūstiet ieskatu savās darbībās ar visaptverošiem pārskatiem un ziņošanas rīkiem.',
    icon: BarChart3,
  },
  {
    name: 'Drošs un Uzticams',
    description: 'Uzņēmuma līmeņa drošība ar Supabase autentifikāciju un šifrētu datu glabāšanu.',
    icon: Shield,
  },
  {
    name: 'Zibens Ātrs',
    description:
      'Izveidots ar modernajām tehnoloģijām optimālai veiktspējai tīmekļa un mobilajās platformās.',
    icon: Zap,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary">Viss, kas nepieciešams</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Jaudīgas Funkcijas Moderniem Uzņēmumiem
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            B3Hub nodrošina visus rīkus, kas nepieciešami efektīvai materiālu un pasūtījumu
            pārvaldībai.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-7xl sm:mt-20 lg:mt-24">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
            {features.map((feature) => (
              <div key={feature.name} className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                    <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
