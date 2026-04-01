import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Container } from '@/components/layout/Container';

export const metadata: Metadata = {
  title: 'Sīkdatņu politika',
  description: 'B3Hub sīkdatņu politika — kādas sīkdatnes mēs izmantojam un kāpēc.',
};

const cookieTypes = [
  {
    type: 'Obligāti nepieciešamās',
    purpose: 'Nodrošina platformas pamatfunkcijas — pieteikšanos, sesiju pārvaldību un drošību.',
    duration: 'Sesija / 1 gads',
    canOptOut: 'Nē',
  },
  {
    type: 'Funkcionālās',
    purpose:
      'Atceras jūsu preferences (valoda, filtra iestatījumi) un nodrošina personalizētu pieredzi.',
    duration: '1 gads',
    canOptOut: 'Jā',
  },
  {
    type: 'Analītiskās',
    purpose:
      'Palīdz mums saprast, kā lietotāji mijiedarbojas ar platformu, lai uzlabotu tās darbību (anonimizēti dati).',
    duration: '2 gadi',
    canOptOut: 'Jā',
  },
  {
    type: 'Mārketinga',
    purpose:
      'Tiek izmantotas, lai rādītu atbilstošus paziņojumus un mērītu mārketinga kampaņu efektivitāti.',
    duration: '90 dienas',
    canOptOut: 'Jā',
  },
];

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background text-foreground">
        {/* Hero */}
        <section className="border-b border-border pt-32 pb-16">
          <Container>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Juridiskā informācija
            </p>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground">
              Sīkdatņu politika
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Mēs izmantojam sīkdatnes, lai nodrošinātu platformas darbību un uzlabotu lietotāja
              pieredzi. Šī politika izskaidro, kādas sīkdatnes izmantojam un kā tās pārvaldīt.
            </p>
          </Container>
        </section>

        {/* What are cookies */}
        <Container as="section" className="py-16 border-b border-border">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-foreground mb-3">Kas ir sīkdatnes?</h2>
            <p className="text-muted-foreground leading-7">
              Sīkdatnes ir nelielas teksta datnes, ko tīmekļa vietne saglabā jūsu ierīcē, kad apmeklējat
              to. Tās palīdz atcerēties jūsu preferences, nodrošina drošu pieteikšanos un ļauj mums
              analizēt platformas lietojumu, lai to pastāvīgi uzlabotu.
            </p>
          </div>
        </Container>

        {/* Cookie table */}
        <Container as="section" className="py-16 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground mb-8">Sīkdatņu veidi</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-6 font-semibold text-foreground">Veids</th>
                  <th className="text-left py-3 pr-6 font-semibold text-foreground">Nolūks</th>
                  <th className="text-left py-3 pr-6 font-semibold text-foreground">Glabāšanas laiks</th>
                  <th className="text-left py-3 font-semibold text-foreground">Var atteikties?</th>
                </tr>
              </thead>
              <tbody>
                {cookieTypes.map((row) => (
                  <tr key={row.type} className="border-b border-border/50 last:border-0">
                    <td className="py-4 pr-6 font-medium text-foreground align-top">{row.type}</td>
                    <td className="py-4 pr-6 text-muted-foreground leading-6 align-top">{row.purpose}</td>
                    <td className="py-4 pr-6 text-muted-foreground align-top">{row.duration}</td>
                    <td className="py-4 text-muted-foreground align-top">{row.canOptOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>

        {/* How to manage */}
        <Container as="section" className="py-16">
          <div className="max-w-3xl space-y-10">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Kā pārvaldīt sīkdatnes?</h2>
              <p className="text-muted-foreground leading-7">
                Izvēles sīkdatnes var atspējot mūsu sīkdatņu iestatījumu panelī (parādās pirmajā apmeklējuma
                reizē). Varat arī mainīt sīkdatņu iestatījumus tieši savā pārlūkprogrammā — instrukcijas
                atšķiras atkarībā no pārlūkprogrammas. Ņemiet vērā, ka obligāti nepieciešamo sīkdatņu
                atspējošana var liegt piekļuvi platformas funkcijām.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Izmaiņas politikā</h2>
              <p className="text-muted-foreground leading-7">
                Šī politika var tikt atjaunināta. Būtiskas izmaiņas tiks paziņotas platformā vai pa e-pastu.
                Pēdējais atjauninājums: 2025. gads.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Kontakti</h2>
              <p className="text-muted-foreground leading-7">
                Jautājumu gadījumā par sīkdatņu lietošanu sazinieties ar mums:{' '}
                <a href="mailto:info@b3hub.lv" className="text-foreground underline underline-offset-4">
                  info@b3hub.lv
                </a>
              </p>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
