import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Navbar } from '@/components/marketing/layout/Navbar';
import { Footer } from '@/components/marketing/layout/Footer';
import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { ContactForm } from '@/components/marketing/contact-form';

export const metadata: Metadata = {
  title: 'Kontakti',
  description: 'Sazinieties ar B3Hub komandu. Esam šeit, lai palīdzētu.',
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="bg-background text-foreground">
        {/* ── HERO ── */}
        <Hero
          eyebrow="Kontakti"
          title={
            <>
              Sazinieties.
            </>
          }
          subtitle="Jautājumi par platformu, partnerību vai tehniski pieprasījumi — mūsu komanda atbild 1 darba dienas laikā."
          align="left"
        />

        {/* ── CONTACT GRID ── */}
        <Container as="section" className="pb-32 border-t border-border pt-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
            {/* Contact info */}
            <div className="bg-background flex flex-col gap-10 p-10">
              <div className="flex items-start gap-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border">
                  <Mail className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">E-pasts</p>
                  <p className="text-muted-foreground font-light text-sm">info@b3hub.lv</p>
                  <p className="text-xs text-muted-foreground">Atbildam 1 darba dienas laikā</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border">
                  <Phone className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Telefons</p>
                  <p className="text-muted-foreground font-light text-sm">+371 20 000 000</p>
                  <p className="text-xs text-muted-foreground">Darba dienās 9:00–18:00</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border">
                  <MapPin className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Adrese</p>
                  <p className="text-muted-foreground font-light text-sm">Rīga, Latvija</p>
                </div>
              </div>
            </div>

            {/* Contact form — client component */}
            <div className="bg-background">
              <ContactForm />
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
