import Link from 'next/link';
import { MapPin, Truck, Package, Container } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const services = [
  {
    icon: Package,
    color: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Materiālu izņemšana',
    description:
      'Iegādājieties materiālus platformā un izņemiet tos B3 laukumā savā transportlīdzeklī. Ideāli privātmāju īpašniekiem un maziem darbuzņēmējiem.',
    tag: 'Nav nepieciešama kravas mašīna',
  },
  {
    icon: Truck,
    color: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Atkritumu nodošana',
    description:
      'Atvediet celtniecības atkritumus un nodododiet tos B3 laukumā. Platforma automātiski ģenerē atkritumu nodošanas apliecību.',
    tag: 'Apliecība automātiski',
  },
  {
    icon: Container,
    color: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Piekaba nomai',
    description:
      'Īrējiet piekabi kopā ar materiālu pasūtījumu un pašrocīgi nogādājiet materiālus uz objektu. Noformējiet visu vienā pasūtījumā.',
    tag: 'Pievienots pasūtījumam',
  },
];

export function B3Fields() {
  return (
    <section id="b3-fields" className="bg-gray-950 py-24 sm:py-32 text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/80 mb-6">
            <MapPin className="h-3.5 w-3.5" />
            Fiziski atrašanās punkti
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            B3 Laukumi — <span className="text-primary">fiziskais tīkls</span>
          </h2>
          <p className="mt-6 text-lg leading-8 text-white/70">
            B3Hub nav tikai digitāla platforma. Mūsu B3 laukumi ir fiziski izpildes centri visā
            Latvijā — kur katrs darījums joprojām plūst caur platformu, tikai bez piegādes mašīnas.
          </p>
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-16">
          {services.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${s.color} mb-5`}
              >
                <s.icon className={`h-6 w-6 ${s.iconColor}`} />
              </div>
              <span className="inline-block rounded-full bg-primary/20 px-3 py-0.5 text-xs font-semibold text-primary mb-3">
                {s.tag}
              </span>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-sm leading-7 text-white/60">{s.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom banner */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 flex flex-col items-center text-center sm:flex-row sm:text-left sm:justify-between gap-6">
          <div>
            <p className="text-lg font-bold text-white">
              Konkurenti var kopēt programmatūru. Fizisku tīklu — ne.
            </p>
            <p className="mt-1 text-sm text-white/60">
              Katrs B3 laukums ir pievienojuma punkts tirgus segmentam, kurš nekad nepasūtīja
              piegādi.
            </p>
          </div>
          <Link
            href={`${APP_URL}/register`}
            className="shrink-0 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            Atrast tuvāko laukumu →
          </Link>
        </div>
      </div>
    </section>
  );
}
