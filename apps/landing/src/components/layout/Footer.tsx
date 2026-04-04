import Link from 'next/link';
import { Container } from './Container';

const navigation = {
  features: [
    { name: 'GPS izsekošana', href: '/features/gps-izsekosana' },
    { name: 'Automātiskie dokumenti', href: '/features/dokumenti' },
    { name: 'Materiālu katalogs', href: '/features/katalogs' },
    { name: 'Projektu vadība', href: '/features/projekti' },
    { name: 'Rēķini & maksājumi', href: '/features/maksajumi' },
    { name: 'Šoferu dispečerizācija', href: '/features/dispets' },
  ],
  platform: [
    { name: 'Būvniekiem', href: '/buvniekiem' },
    { name: 'Pārvadātājiem', href: '/parvadatajiem' },
    { name: 'Karjeriem & piegādātājiem', href: '/karjeriem' },
    { name: 'B3 Fields', href: '/b3-fields' },
    { name: 'Cenas', href: '/pricing' },
  ],
  company: [
    { name: 'Par mums', href: '/about' },
    { name: 'Kontakti', href: '/contact' },
    { name: 'Blogs', href: '/blog' },
  ],
  legal: [
    { name: 'Privātuma politika', href: '/privacy' },
    { name: 'Lietošanas noteikumi', href: '/terms' },
    { name: 'Sīkdatnes', href: '/cookies' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-black text-gray-400" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <Container className="pb-8 pt-24 lg:pt-32">
        <div className="xl:grid xl:grid-cols-2 xl:gap-8">
          {/* Brand & Mission - left side */}
          <div className="space-y-6 xl:col-span-1">
            <Link href="/" className="inline-block">
              <span className="text-4xl font-medium tracking-tighter text-white">B3Hub</span>
            </Link>
            <p className="max-w-sm text-lg leading-relaxed text-gray-400 font-light tracking-tight">
              Aizstājam zvanus un e-pastus ar vienotu platformu celtniecības loģistikai.
            </p>
            {/* App store badges */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="https://apps.apple.com/app/b3hub"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors px-5 py-3 border border-white/10"
                aria-label="Lejupielādēt App Store"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="flex flex-col leading-tight">
                  <span className="text-gray-400 text-xs">Lejupielādēt</span>
                  <span className="text-white text-sm font-medium">App Store</span>
                </div>
              </Link>
              <Link
                href="https://play.google.com/store/apps/details?id=com.b3hub"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors px-5 py-3 border border-white/10"
                aria-label="Lejupielādēt Google Play"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0" aria-hidden="true">
                  <path d="M3.18 23.76c.3.17.66.19.99.04l13.2-7.62-2.84-2.84-11.35 10.42zM.5 1.51C.18 1.84 0 2.35 0 3.01v17.98c0 .66.18 1.17.5 1.5l.08.08 10.07-10.07v-.24L.58 1.43.5 1.51zM20.49 10.41l-2.86-1.65-3.18 3.18 3.18 3.17 2.88-1.66c.82-.47.82-1.56-.02-2.04zM3.18.24l13.2 7.62-2.84 2.84L2.19.28C2.52.13 2.88.07 3.18.24z" />
                </svg>
                <div className="flex flex-col leading-tight">
                  <span className="text-gray-400 text-xs">Lejupielādēt</span>
                  <span className="text-white text-sm font-medium">Google Play</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Navigation - right side */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-10 xl:col-span-1 xl:mt-0">
            <div>
              <h3 className="text-lg font-medium text-white tracking-tight mb-6">
                <a href="/features" className="hover:opacity-80 transition-opacity">
                  Funkcijas
                </a>
              </h3>
              <ul role="list" className="space-y-3">
                {navigation.features.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-sm hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white tracking-tight mb-6">Platforma</h3>
              <ul role="list" className="space-y-4">
                {navigation.platform.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-base hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium text-white tracking-tight mb-6">Uzņēmums</h3>
              <ul role="list" className="space-y-4">
                {navigation.company.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-base hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium text-white tracking-tight mb-6">Juridiski</h3>
              <ul role="list" className="space-y-4">
                {navigation.legal.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-base hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-24 border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} B3Hub. Visas tiesības aizsargātas.
          </p>
          <div className="flex gap-6">
            <Link
              href="https://www.instagram.com/b3hub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              Instagram
            </Link>
            <Link
              href="https://www.linkedin.com/company/b3hub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              LinkedIn
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
