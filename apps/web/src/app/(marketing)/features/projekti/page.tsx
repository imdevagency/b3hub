import { Hero } from '@/components/marketing/layout/Hero';
import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import { Check, ArrowLeft, FolderKanban, FileCheck, BarChart3, Users } from 'lucide-react';
import Link from 'next/link';


const benefits = [
  {
    icon: FolderKanban,
    title: 'Vairāki projekti vienlaicīgi',
    body: 'Katrs projekts — sava mājaslapa pasūtījumiem, piegādēm un dokumentiem. Pārslēdzies starp projektiem ar vienu klikšķi.',
  },
  {
    icon: FileCheck,
    title: 'Ietvara līgumi & izsaukumi',
    body: 'Noslēdz ietvara līgumu ar karjeru — fiksē cenu un apjomu. Izsauc piegādes atsevišķi bez atkārtotas vienošanās.',
  },
  {
    icon: BarChart3,
    title: 'Apjomu kontrole reāllaikā',
    body: 'Redzi, cik tonnu no plānotā apjoma jau ir piegādāts. Brīdinājumi, kad tuvojas ietvara robežai.',
  },
  {
    icon: Users,
    title: 'Komandas piekļuves vadība',
    body: 'Piešķir komandas locekļiem piekļuvi konkrētiem projektiem. Vadītājs redzi visu, meistars — tikai savu objektu.',
  },
];

export default function ProjektiPage() {
  return (
    <>
      <main className="bg-background w-full overflow-clip">
        {/* Back */}
        <Container className="pt-28 pb-0">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Visas funkcijas
          </Link>
        </Container>

        {/* HERO */}
        <Hero
          eyebrow="Projektu Vadība"
          title={
            <>
              Desmit objekti.
              <br />
              Viens pārskats.
              <br />
              Pilna kontrole.
            </>
          }
          subtitle="Organizē pasūtījumus pa projektiem, ietvara līgumiem un izsaukumiem. Pārskats par piegādātajiem apjomiem un tēriņiem katrā objektā."
          actions={
            <CTAButton href={`/register`} variant="primary" size="lg">
              Sākt projektu vadību
            </CTAButton>
          }
        >
          {/* Projects mock */}
          <div className="w-full border border-border flex flex-col text-sm self-center">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="font-bold text-sm">Mani projekti</span>
              <span className="text-xs text-muted-foreground">3 aktīvi</span>
            </div>

            {/* Active project */}
            <div className="border-b border-border px-6 py-5 bg-muted/10">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold">Bytona iela 14 — Rīga</p>
                  <p className="text-xs text-muted-foreground mt-0.5">ILG-014 · 500 t plānots</p>
                </div>
                <span className="text-xs font-bold tracking-wide uppercase border border-foreground/30 px-2 py-1">
                  Aktīvs
                </span>
              </div>
              {/* Progress */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Piegādāts</span>
                  <span className="font-bold text-foreground">284 / 500 t</span>
                </div>
                <div className="relative w-full h-1.5 bg-border">
                  <div
                    className="absolute top-0 left-0 h-1.5 bg-foreground"
                    style={{ width: '56.8%' }}
                  />
                </div>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border text-xs">
                {[
                  { v: '5', l: 'Izsaukumi' },
                  { v: '12', l: 'Piegādes' },
                  { v: '€11 200', l: 'Kopā' },
                ].map(({ v, l }) => (
                  <div key={l}>
                    <p className="font-bold">{v}</p>
                    <p className="text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Other projects */}
            <div className="flex flex-col divide-y divide-border">
              {[
                { name: 'Juglas tilts — pamati', ref: 'ILG-009', done: 120, total: 200, calls: 3 },
                { name: 'Mežciems dzīvokļi', ref: 'ILG-021', done: 42, total: 150, calls: 1 },
              ].map(({ name, ref, done, total, calls }) => (
                <div key={ref} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-xs">{name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ref} · {calls} izsaukumi
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xs">
                      {done} / {total} t
                    </p>
                    <div className="w-16 h-0.5 bg-border mt-1.5 ml-auto">
                      <div
                        className="h-0.5 bg-foreground/50"
                        style={{ width: `${(done / total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Hero>

        {/* BENEFITS */}
        <section className="w-full bg-neutral-50">
        <Container className="py-24">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-12">
            Projektu vadība — bez Excel
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

        {/* Ietvara līgumi section */}
        <section className="w-full bg-background">
          <Container className="py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-6">
                  Ietvara līgumi
                </p>
                <h2 className="text-4xl font-bold tracking-tighter leading-tight mb-6">
                  Fiksē cenu un apjomu
                  <br />
                  uz visu projektu.
                </h2>
                <p className="text-muted-foreground font-light leading-relaxed mb-8">
                  Noslēdz ietvara līgumu ar piegādātāju — fiksēta cena, fiksēts apjoms. Atsevišķas
                  piegādes piesakas kā &ldquo;izsaukumi&rdquo; bez jaunas vienošanās. Platforma seko
                  apjomam un brīdina, kad tuvojas robežai.
                </p>
                <ul className="flex flex-col gap-3">
                  {[
                    'Fiksēta cena visam projektam',
                    'Apjoma pārbaude katram izsaukumam',
                    'Automātisks brīdinājums pie 80% apjoma',
                    'Kopsavilkums projekta beigās',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <Check className="w-4 h-4 shrink-0 text-foreground" strokeWidth={2.5} />
                      <span className="font-light">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Framework contract mock */}
              <div className="border border-border">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <span className="font-bold text-sm">ILG-014</span>
                  <span className="text-xs font-bold tracking-wide text-foreground uppercase">
                    Aktīvs
                  </span>
                </div>
                <div className="p-6 flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    {[
                      { l: 'Piegādātājs', v: 'Liepa SIA' },
                      { l: 'Materiāls', v: 'Granīta šķembas' },
                      { l: 'Cena', v: '€9.50 / t' },
                      { l: 'Plānotais apjoms', v: '500 t' },
                    ].map(({ l, v }) => (
                      <div key={l}>
                        <p className="text-xs text-muted-foreground mb-0.5">{l}</p>
                        <p className="font-bold">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-5">
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Plūsma</span>
                      <span className="font-bold text-foreground">284 / 500 t (56.8%)</span>
                    </div>
                    <div className="relative w-full h-2 bg-border">
                      <div
                        className="absolute top-0 left-0 h-2 bg-foreground"
                        style={{ width: '56.8%' }}
                      />
                    </div>
                  </div>
                  <div className="border border-border p-4 text-xs flex items-start gap-3">
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="text-muted-foreground">
                      4 izsaukumi atvērti, 12 piegādes izpildītas. Nākošais apjoma brīdinājums pie
                      400 t.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* CTA */}
        <section className="w-full py-32 bg-foreground">
          <Container className="flex flex-col md:flex-row items-center justify-between gap-12">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-background leading-tight">
              Organizē savus
              <br />
              projektus digitāli.
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
