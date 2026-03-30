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
    description: 'Uzņēmuma līmeņa drošība ar šifrētu datu glabāšanu un uzlabotu arhitektūru.',
    icon: Shield,
  },
  {
    name: 'Zibens Ātrs',
    description:
      'Piekļuve sistēmai reāllaikā — gan no biroja, gan no būvlaukuma izmantojot mobilo lietotni.',
    icon: Zap,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-gray-50 py-32 sm:py-40 border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-24">
          <p className="mt-2 text-4xl font-bold tracking-tighter text-black sm:text-5xl">
            Viss, kas nepieciešams.
          </p>
          <p className="mt-6 text-lg text-gray-500">
            Platforma, kas automatizē, seko un dokumentē. Sistēma radīta profesionāļiem.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-7xl">
          <dl className="grid grid-cols-1 gap-px bg-gray-200 border border-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="bg-white p-10 hover:bg-gray-50 transition-colors">
                <dt className="text-lg font-bold text-black mb-4">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center border border-gray-200">
                    <feature.icon
                      className="h-5 w-5 text-black"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                  </div>
                  {feature.name}
                </dt>
                <dd className="text-sm leading-relaxed text-gray-500">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
