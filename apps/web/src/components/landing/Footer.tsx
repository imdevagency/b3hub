/**
 * Landing page footer.
 * Site links, social icons, and copyright information.
 */
import Link from 'next/link';

const navigation = {
  product: [
    { name: 'Funkcijas', href: '#features' },
    { name: 'Cenas', href: '#' },
    { name: 'Mobilā Lietotne', href: '#' },
  ],
  company: [
    { name: 'Par Mums', href: '#' },
    { name: 'Blogs', href: '#' },
    { name: 'Kontakti', href: '#' },
  ],
  legal: [
    { name: 'Privātuma Politika', href: '#' },
    { name: 'Lietošanas Noteikumi', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-white" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16 sm:pt-24 lg:px-8 lg:pt-32">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8">
            <div className="text-2xl font-bold text-red-600">B3Hub</div>
            <p className="text-sm leading-6 text-gray-600">
              Sakārtojiet materiālu pasūtījumus un piegādes ķēdes pārvaldību.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-8 xl:col-span-2 xl:mt-0">
            <div>
              <h3 className="text-sm font-semibold leading-6 text-gray-900">Produkts</h3>
              <ul role="list" className="mt-6 space-y-4">
                {navigation.product.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm leading-6 text-gray-600 hover:text-gray-900"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-6 text-gray-900">Uzņēmums</h3>
              <ul role="list" className="mt-6 space-y-4">
                {navigation.company.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm leading-6 text-gray-600 hover:text-gray-900"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-6 text-gray-900">Juridisks</h3>
              <ul role="list" className="mt-6 space-y-4">
                {navigation.legal.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm leading-6 text-gray-600 hover:text-gray-900"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-16 border-t border-gray-900/10 pt-8 sm:mt-20 lg:mt-24">
          <p className="text-xs leading-5 text-gray-500">
            &copy; {new Date().getFullYear()} B3Hub. Visas tiesības aizsargātas.
          </p>
        </div>
      </div>
    </footer>
  );
}
