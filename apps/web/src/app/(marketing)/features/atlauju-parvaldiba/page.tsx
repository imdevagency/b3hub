import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { ArrowLeft, Lock, Users, ShieldCheck, Settings } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: Users,
    title: 'Lomas katram darbiniekam',
    body: 'Pievieno šoferi, vadītājus un administratorus. Katram ir sava loma — OWNER, MANAGER, DRIVER vai MEMBER — ar atbilstošām tiesībām.',
  },
  {
    icon: Lock,
    title: 'Piecas granulārās atļaujas',
    body: 'Kontrolē, kas var izveidot līgumus, atbrīvot izsaukumus, pārvaldīt pasūtījumus, skatīt finanses vai rediģēt komandu — neatkarīgi no lomas.',
  },
  {
    icon: ShieldCheck,
    title: 'Neviens nevar vairāk nekā vajag',
    body: 'Šoferis redz tikai savus darbus. Grāmatvedis redz tikai finanses. Katram tikai tas, kas viņam nepieciešams darbā.',
  },
  {
    icon: Settings,
    title: 'Elastīga administrēšana',
    body: 'Īpašnieks var mainīt atļaujas jebkurā brīdī. Jauns darbinieks vai izmaiņas pienākumos — atjaunini profilā sekundē.',
  },
];

export default function AtlaujasParvaldibsPage() {
  return (
    <>
      <main className="bg-background w-full overflow-clip">
        <Container className="pt-28 pb-0">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Visas funkcijas
          </Link>
        </Container>

        <Hero
          eyebrow="Atļauju Pārvaldība"
          title={
            <>
              Katram tikai
              <br />
              viņa pienākumi.
            </>
          }
          subtitle="Pievieno visu komandu vienam uzņēmuma kontam. Lomas un granulārās atļaujas nodrošina, ka katrs redz un var darīt tikai to, kas viņam pienākas."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Pievienot komandu
            </CTAButton>
          }
        >
          <div className="w-full border border-border flex flex-col text-sm self-center">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <span className="font-bold text-sm">Komandas locekļi</span>
              <span className="text-xs text-muted-foreground">SIA Latvijas Būve</span>
            </div>
            {[
              { name: 'Andris Kalniņš', role: 'OWNER', perms: ['Viss'] },
              { name: 'Marta Ozola', role: 'MANAGER', perms: ['Pasūtījumi', 'Finanses'] },
              { name: 'Jānis Bērziņš', role: 'DRIVER', perms: ['Darbi'] },
              { name: 'Ilze Liepa', role: 'MEMBER', perms: ['Skatīt'] },
            ].map(({ name, role, perms }) => (
              <div
                key={name}
                className="flex items-center justify-between px-6 py-4 border-b border-border last:border-b-0"
              >
                <div>
                  <p className="font-medium text-xs">{name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{perms.join(' · ')}</p>
                </div>
                <span className="text-xs font-bold tracking-widest uppercase border border-border px-2 py-1">
                  {role}
                </span>
              </div>
            ))}
          </div>
        </Hero>

        <section className="w-full bg-neutral-50">
        <Container className="py-24">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Kāpēc tas ir svarīgi
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border divide-y md:divide-y-0 md:divide-x divide-border">
            {benefits.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-8 flex flex-col gap-4">
                <Icon className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Container>
        </section>

        <section className="w-full bg-background">
          <Container className="py-24">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
              Pievienot darbinieku — 4 soļi
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:divide-x divide-border">
              {[
                {
                  step: '01',
                  title: 'Uzaicini',
                  body: 'Nosūti uzaicinājumu uz e-pastu. Darbinieks izveido kontu vai piesakās ar esošo.',
                },
                {
                  step: '02',
                  title: 'Piešķir lomu',
                  body: 'Izvēlies DRIVER, MEMBER, MANAGER vai OWNER.',
                },
                {
                  step: '03',
                  title: 'Iestata atļaujas',
                  body: 'Atzīmē, kuras piecas funkcijas šis cilvēks drīkst izmantot.',
                },
                {
                  step: '04',
                  title: 'Gatavs',
                  body: 'Darbinieks uzreiz redz savu darba skatu — bez papildu konfigurēšanas.',
                },
              ].map(({ step, title, body }) => (
                <div
                  key={step}
                  className="md:px-10 first:pl-0 last:pr-0 py-8 md:py-0 flex flex-col gap-4"
                >
                  <span className="text-4xl font-bold tracking-tighter text-border">{step}</span>
                  <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground font-light text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-background leading-tight">
              Viss uzņēmums —
              <br />
              vienā kontā.
            </h2>
            <div className="flex flex-col gap-4 min-w-fit">
              <CTAButton href={`/register`} variant="inverted" size="lg">
                Reģistrēties bez maksas
              </CTAButton>
              <p className="text-center text-background/40 text-sm">Nav nepieciešama kredītkarte</p>
            </div>
          </Container>
        </section>
      </main>
    </>
  );
}
