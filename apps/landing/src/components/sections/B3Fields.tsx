import Link from 'next/link';
import { MapPin, Truck, Package, Container } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const services = [
  {
    icon: Package,
    title: 'Materiālu izņemšana',
    description:
      'Iegādājieties materiālus platformā un izņemiet tos B3 laukumā savā transportlīdzeklī. Ideāli privātmāju īpašniekiem un maziem darbuzņēmējiem.',
    tag: 'Tūlītēja pieejamība',
  },
  {
    icon: Truck,
    title: 'Atkritumu nodošana',
    description:
      'Atvediet celtniecības atkritumus un nododiet tos B3 laukumā. Platforma automātiski ģenerē atkritumu nodošanas apliecību.',
    tag: 'Apliecība automātiski',
  },
  {
    icon: Container,
    title: 'Piekabe nomai',
    description:
      'Īrējiet piekabi kopā ar materiālu pasūtījumu un pašrocīgi nogādājiet materiālus uz objektu. Noformējiet visu vienā pasūtījumā.',
    tag: 'Nav vajadzīgs kravas auto',
  },
];

export function B3Fields() {
  return (
    <section id="b3-fields" className="bg-black py-32 sm:py-40 text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-24">
          <div className="inline-flex items-center gap-2 border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/60 mb-6">
            <MapPin className="h-3.5 w-3.5" />
            Fiziskais tīkls
          </div>
          <p className="text-4xl font-bold tracking-tighter text-white sm:text-5xl">B3 Laukumi.</p>
          <p className="mt-6 text-lg text-white/50">
            Fiziski izpildes centri visā Latvijā. Katrs darījums reģistrēts platformā, pat bez mūsu
            transporta.
          </p>
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-1 gap-px bg-white/10 border border-white/10 sm:grid-cols-3 mb-24">
          {services.map((s) => (
            <div
              key={s.title}
              className="bg-black p-8 hover:bg-white/2 transition-colors flex flex-col"
            >
              <div className="mb-8">
                <s.icon className="h-6 w-6 text-white" strokeWidth={1.5} />
              </div>
              <span className="block text-[10px] font-bold tracking-widest uppercase text-white/40 mb-4">
                {s.tag}
              </span>
              <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{s.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom banner */}
        <div className="border border-white/10 p-12 flex flex-col items-center text-center sm:flex-row sm:text-left sm:justify-between gap-8">
          <div>
            <p className="text-xl font-bold tracking-tight text-white mb-1">
              Programmatūru var nokopēt. Infrastruktūru — ne.
            </p>
            <p className="text-sm text-white/50">
              Katrs B3 laukums ir platformas pievienošanās punkts jaunai auditorijai.
            </p>
          </div>
          <Link
            href={`${APP_URL}/register`}
            className="shrink-0 bg-white px-8 py-3.5 text-sm font-medium text-black hover:bg-gray-200 transition-colors"
          >
            Atrast tuvāko laukumu →
          </Link>
        </div>
      </div>
    </section>
  );
}
