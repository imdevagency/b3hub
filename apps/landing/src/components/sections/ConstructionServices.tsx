import Link from 'next/link';
import { Shovel, HardHat, Hammer, TreePine, Waves, ArrowRight } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const services = [
  {
    icon: Shovel,
    color: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Zemes darbi',
    description:
      'Izrakšana, uzbērumi, planēšana un pamatbedru sagatavošana. Aprīkojums un pieredzējusi brigāde.',
    examples: ['Pamatu bedres', 'Grunts planēšana', 'Kanālu rakšana', 'Uzbērumi'],
  },
  {
    icon: Hammer,
    color: 'bg-red-50',
    iconColor: 'text-primary',
    title: 'Nojaukšana',
    description:
      'Ēku, sienu un konstrukciju nojaukšana ar mehānizētu aprīkojumu. Atkritumi tiek utilizēti caur B3Hub platformu.',
    examples: ['Ēku nojaukšana', 'Sienu demontāža', 'Betona laušana', 'Atkritumu izvešana'],
  },
  {
    icon: HardHat,
    color: 'bg-stone-100',
    iconColor: 'text-stone-600',
    title: 'Iebrauktuves un laukumi',
    description:
      'Iebrauktuvju, autostāvvietu un pagalmu ierīkošana ar dolomītu, betonu vai asfalta segumu.',
    examples: ['Privātās iebrauktuves', 'Stāvlaukumi', 'Saimniecības ceļi', 'Seguma atjaunošana'],
  },
  {
    icon: Waves,
    color: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Drenāža un komunikācijas',
    description:
      'Lietus ūdens drenāžas sistēmas, pagalmu noteku ierīkošana un inženierkomunikāciju tranšejas.',
    examples: ['Lietus ūdens sistēmas', 'Pagalmu noteces', 'Inžentranšejas', 'Drenāžas slāņi'],
  },
  {
    icon: TreePine,
    color: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Labiekārtošana',
    description:
      'Reljefa veidošana, augsnes piegāde un kultivēšana, apzaļumošanas darbi un dārzu ierīkošana.',
    examples: ['Apzaļumošana', 'Augsnes ievešana', 'Taciņas un laukumi', 'Dārzu ierīkošana'],
  },
  {
    icon: Shovel,
    color: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Atkritumu utilizācija',
    description:
      'Celtniecības atkritumu savākšana un nogāde uz B3 laukumu vai sertificētu pārstrādes centru. Apliecība automātiski.',
    examples: ['Betona atkritumi', 'Grunts utilizācija', 'Gruveši', 'Jumta materiāli'],
  },
];

export function ConstructionServices() {
  return (
    <section id="construction-services" className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-base font-semibold leading-7 text-primary uppercase tracking-wide">
            Celtniecības pakalpojumi
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            No digitālā — līdz fiziskam rezultātam
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            B3Hub ne tikai koordinē piegādes. Mūsu komanda izpilda zemes darbus, nojaukšanu un
            labiekārtošanu — visi darbi noformēti un dokumentēti caur platformu.
          </p>
        </div>

        {/* Service grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl bg-white border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${s.color} mb-5`}
              >
                <s.icon className={`h-6 w-6 ${s.iconColor}`} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm leading-7 text-gray-600 flex-1">{s.description}</p>

              {/* Tag list */}
              <div className="mt-5 flex flex-wrap gap-2">
                {s.examples.map((ex) => (
                  <span
                    key={ex}
                    className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-primary p-10 text-center">
          <h3 className="text-2xl font-bold text-white">Nepieciešams aprēķins vai konsultācija?</h3>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
            Nosūtiet pieprasījumu caur platformu — mūsu komanda sagatavos piedāvājumu darba dienas
            laikā.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-primary hover:bg-white/90 transition-colors"
            >
              Sazināties <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`${APP_URL}/register`}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-6 py-3 text-sm font-semibold text-white hover:border-white hover:bg-white/10 transition-colors"
            >
              Izveidot kontu un pasūtīt
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
