import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
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
      <main className="bg-background text-foreground">
        {/* ── HERO ── */}
        <Hero
          eyebrow="Kontakti"
          title={<>Sazinieties.</>}
          subtitle="Jautājumi par platformu, partnerību vai tehniski pieprasījumi — mūsu komanda atbild 1 darba dienas laikā."
          align="left"
          wrapperClassName="bg-background"
        />

        {/* ── CONTACT GRID ── */}
        <section className="w-full bg-neutral-100">
          <Container className="pb-32 pt-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
              {/* Contact info */}
              <div className="flex flex-col gap-12 lg:pr-10 lg:py-10">
                <div className="flex items-start gap-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-background text-foreground shadow-sm">
                    <Mail className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className="text-xl font-medium tracking-tight">E-pasts</p>
                    <p className="text-muted-foreground font-light text-base">info@b3hub.lv</p>
                    <p className="text-sm text-muted-foreground/70">
                      Atbildam 1 darba dienas laikā
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-background text-foreground shadow-sm">
                    <Phone className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className="text-xl font-medium tracking-tight">Telefons</p>
                    <p className="text-muted-foreground font-light text-base">+371 20 000 000</p>
                    <p className="text-sm text-muted-foreground/70">Darba dienās 9:00–18:00</p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-background text-foreground shadow-sm">
                    <MapPin className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className="text-xl font-medium tracking-tight">Adrese</p>
                    <p className="text-muted-foreground font-light text-base">Rīga, Latvija</p>
                  </div>
                </div>
              </div>

              {/* Contact form — client component */}
              <div className="w-full">
                <ContactForm />
              </div>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
