import Link from 'next/link';
import { Building2 } from 'lucide-react';

const navigation = {
  product: [
    { name: 'Materiālu katalogs', href: '/#materials' },
    { name: 'B3 Laukumi', href: '/#b3-fields' },
    { name: 'Celtniecības pakalpojumi', href: '/#construction-services' },
    { name: 'Cenas', href: '/pricing' },
  ],
  company: [
    { name: 'Par mums', href: '/about' },
    { name: 'Blogs', href: '/blog' },
    { name: 'Kontakti', href: '/contact' },
  ],
  suppliers: [
    {
      name: 'Kļūt par piegādātāju',
      href: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/apply`,
    },
    {
      name: 'Kļūt par pārvadātāju',
      href: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/apply`,
    },
  ],
  legal: [
    { name: 'Privātuma politika', href: '/privacy' },
    { name: 'Lietošanas noteikumi', href: '/terms' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16 sm:pt-24 lg:px-8 lg:pt-32">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          {/* Brand */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold text-white">B3Hub</span>
            </Link>
            <p className="text-sm leading-6">
              Celtniecības loģistikas platforma Latvijas un Baltijas tirgum. Savieno pircējus,
              piegādātājus un pārvadātājus.
            </p>
            <p className="text-xs">
              © {new Date().getFullYear()} B3Hub. Visas tiesības aizsargātas.
            </p>
          </div>

          {/* Nav columns */}
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0 sm:grid-cols-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Produkts</h3>
              <ul role="list" className="mt-6 space-y-4">
                {navigation.product.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-sm hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Uzņēmums</h3>
              <ul role="list" className="mt-6 space-y-4">
                {navigation.company.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-sm hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Partneri</h3>
              <ul role="list" className="mt-6 space-y-4">
                {navigation.suppliers.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-sm hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Juridisks</h3>
              <ul role="list" className="mt-6 space-y-4">
                {navigation.legal.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-sm hover:text-white transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
