import Link from 'next/link';

const navigation = {
  platform: [
    { name: 'Pasūtīt materiālus', href: '/pasutit' },
    { name: 'Kļūt par pārvadātāju', href: '/parvadat' },
    { name: 'Pievienot karjeru', href: '/karjeriem' },
    { name: 'Uzņēmumiem', href: '/buvniekiem' },
  ],
  company: [
    { name: 'Par mums', href: '/about' },
    { name: 'Kontakti', href: '/contact' },
    { name: 'Karjera', href: '/careers' },
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
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-24 lg:px-12 lg:pt-32">
        <div className="xl:grid xl:grid-cols-2 xl:gap-8">
          {/* Brand & Mission - left side */}
          <div className="space-y-6 xl:col-span-1">
            <Link href="/" className="inline-block">
              <span className="text-4xl font-medium tracking-tighter text-white">B3Hub</span>
            </Link>
            <p className="max-w-sm text-lg leading-relaxed text-gray-400 font-light tracking-tight">
              Aizstājam zvanus un e-pastus ar vienotu platformu celtniecības loģistikai.
            </p>
          </div>

          {/* Navigation - right side */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-12 xl:col-span-1 xl:mt-0">
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
            <Link href="#" className="text-sm text-gray-500 hover:text-white transition-colors">
              Instagram
            </Link>
            <Link href="#" className="text-sm text-gray-500 hover:text-white transition-colors">
              LinkedIn
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
