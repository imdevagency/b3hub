import Link from 'next/link';
import { Shovel, HardHat, Hammer, TreePine, Waves, ArrowRight } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const services = [
  {
    icon: Shovel,
    title: 'Zemes darbi',
    description:
      'Izrakšana, uzbērumi, planēšana un pamatbedru sagatavošana. Aprīkojums un pieredzējusi brigāde.',
    examples: ['Pamatu bedres', 'Grunts planēšana', 'Kanālu rakšana', 'Uzbērumi'],
  },
  {
    icon: Hammer,
    title: 'Nojaukšana',
    description:
      'Ēku, sienu un konstrukciju nojaukšana ar mehānizētu aprīkojumu. Atkritumi tiek utilizēti caur platformu.',
    examples: ['Ēku nojaukšana', 'Sienu demontāža', 'Betona laušana', 'Atkritumu izvešana'],
  },
  {
    icon: HardHat,
    title: 'Iebrauktuves un laukumi',
    description:
      'Iebrauktuvju, autostāvvietu un pagalmu ierīkošana ar dolomītu, betonu vai asfalta segumu.',
    examples: ['Privātās iebrauktuves', 'Stāvlaukumi', 'Saimniecības ceļi', 'Seguma atjaunošana'],
  },
  {
    icon: Waves,
    title: 'Drenāža un komunikācijas',
    description:
      'Lietus ūdens drenāžas sistēmas, pagalmu noteku ierīkošana un inženierkomunikāciju tranšejas.',
    examples: ['Lietus ūdens sistēmas', 'Pagalmu noteces', 'Inžentranšejas', 'Drenāžas slāņi'],
  },
  {
    icon: TreePine,
    title: 'Labiekārtošana',
    description:
      'Reljefa veidošana, augsnes piegāde un kultivēšana, apzaļumošanas darbi un dārzu ierīkošana.',
    examples: ['Apzaļumošana', 'Augsnes ievešana', 'Taciņas un laukumi', 'Dārzu ierīkošana'],
  },
  {
    icon: Shovel,
    title: 'Atkritumu utilizācija',
    description:
      'Celtniecības atkritumu savākšana un nogāde uz pārstrādes centru. Apliecība automātiski.',
    examples: ['Betona atkritumi', 'Grunts utilizācija', 'Gruveši', 'Jumta materiāli'],
  },
];

export function ConstructionServices() {
  return (
    <section
      id="construction-services"
      className="bg-white border-t border-gray-200 py-32 sm:py-40"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-24">
          <p className="mt-2 text-4xl font-bold tracking-tighter text-black sm:text-5xl">
            Celtniecības pakalpojumi.
          </p>
          <p className="mt-6 text-lg text-gray-500">
            Fiziska izpilde, ko atbalsta digitāla platforma. No nojaukšanas līdz labiekārtošanai.
          </p>
        </div>

        {/* Service grid */}
        <div className="grid grid-cols-1 gap-px bg-gray-200 border border-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.title}
              className="bg-white p-8 flex flex-col hover:bg-gray-50 transition-colors"
            >
              <div className="mb-8">
                <s.icon className="h-6 w-6 text-black" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-black mb-3">{s.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500 flex-1">{s.description}</p>

              {/* Tag list */}
              <div className="mt-8 flex flex-wrap gap-2">
                {s.examples.map((ex) => (
                  <span
                    key={ex}
                    className="border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-500"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-24 border border-black bg-black p-12 text-center">
          <h3 className="text-3xl font-bold tracking-tight text-white mb-4">
            Nepieciešams aprēķins?
          </h3>
          <p className="text-gray-400 max-w-xl mx-auto mb-10">
            Sazinieties ar mums vai izveidojiet pieprasījumu platformā. Gatavojam piedāvājumus
            vienas darba dienas laikā.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="w-full sm:w-auto bg-white px-8 py-3.5 text-sm font-medium text-black hover:bg-gray-100 transition-colors inline-flex items-center justify-center gap-2"
            >
              Sazināties <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`${APP_URL}/register`}
              className="w-full sm:w-auto border border-white/20 px-8 py-3.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Atvērt platformu
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
