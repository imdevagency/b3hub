import { Container } from '@/components/marketing/layout/Container';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import {
  ArrowRight,
  Building2,
  Package,
  Truck,
  Recycle,
  Leaf,
  Database,
  ShoppingCart,
  PackageOpen,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="bg-white w-full overflow-hidden">
      {/* BRAND GRADIENT STRIP */}
      <div className="h-1.5 w-full bg-linear-to-r from-primary via-primary/50 to-foreground" />

      {/* ── 1. HERO ── */}
      <section className="w-full bg-white">
        <Container className="py-24 md:py-40 flex flex-col items-center text-center gap-6">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Īstā apritīgā ekonomika celtniecības nozarē
          </p>
          <h1 className="text-6xl md:text-8xl font-medium tracking-tighter leading-none max-w-5xl">
            Platforma materiālu plūsmām.
          </h1>
          <p className="text-2xl md:text-3xl font-light tracking-tight text-muted-foreground">
            Ilgtspējīgi. Digitāli. Efektīvi.
          </p>
          <p className="text-lg text-muted-foreground font-light max-w-2xl mt-2">
            Bilt ir viss vienā digitālā platforma celtniecības objektu apgādei un atkritumu
            apsaimniekošanai — neitrāls tirgus, apritīgās ekonomikas virzītājs un optimizētu
            materiālu plūsmu eksperts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <CTAButton href="/register" variant="primary" size="lg">
              Reģistrēties tagad <ArrowRight className="w-5 h-5" />
            </CTAButton>
            <CTAButton href="/login" variant="outline" size="lg">
              Pieslēgties
            </CTAButton>
          </div>
        </Container>
      </section>

      {/* ── 2. ECOSYSTEM (dark) ── */}
      <section className="w-full bg-[#203728] text-white">
        <Container className="py-24 flex flex-col items-center text-center gap-6">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-white/40">
            Bilt kā ekosistēma
          </p>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tighter leading-tight text-white max-w-3xl">
            Ilgtspējīgas celtniecības ekosistēma.
          </h2>
          <p className="text-lg text-white/70 font-light leading-relaxed max-w-2xl">
            Bilt apvieno platformas zināšanas ar pārstrādes speciālistu ekspertīzi un saviem
            pārstrādes centriem. Ar datu vadītu materiālu plūsmu pārvaldību mēs veidojam unikālu
            piedāvājumu patiesai apritīgajai ekonomikai celtniecības nozarē.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 w-full text-left max-w-4xl">
            {[
              {
                icon: Database,
                label: 'Materiālu plūsmu dati',
                body: 'Mēs zinām, kādi materiāli rodas "pilsētu karjeros" — nojaukšanas un demontāžas laikā — un kur, kas un kad ir vajadzīgs.',
              },
              {
                icon: Recycle,
                label: 'Pašu pārstrādes centri',
                body: 'Mūsu pārstrādes centri nodrošina ātru un uzticamu RC materiālu piegādi — īstajā laikā un atbilstošā kvalitātē.',
              },
              {
                icon: Leaf,
                label: 'Ekoloģiskā efektivitāte',
                body: 'Tādā veidā mēs palīdzam ilgtspējīgi samazināt nozares ekoloģisko pēdas nospiedumu un veicinām klimatneitralitāti.',
              },
            ].map(({ icon: Icon, label, body }) => (
              <div key={label} className="flex flex-col gap-3">
                <div className="p-3 bg-white/10 w-fit rounded-xl">
                  <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
                </div>
                <p className="font-semibold text-white text-sm">{label}</p>
                <p className="text-white/60 text-sm font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── 3. PLATFORM FOR 4 SIDES ── */}
      <section className="w-full bg-neutral-50 border-t border-border">
        <Container className="py-24">
          <div className="flex flex-col items-center text-center gap-4 mb-16">
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">
              Platforma celtniecības objektu apgādei un atkritumu apsaimniekošanai
            </p>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight max-w-3xl">
              Bilt ir pirmais digitālais loģistikas mezgls, kas savieno visu nozari.
            </h2>
            <p className="text-lg text-muted-foreground font-light max-w-2xl">
              Mēs esam neitrāls tirgus: mēs nekonkurējam — mēs savienojam. Un katrs tirgus
              dalībnieks gūst labumu savā veidā.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Building2,
                title: 'Būvuzņēmumi',
                body: 'Pasūtiet biruma materiālus un transporta pakalpojumus, kā arī nogādājiet minerālos būvniecības atkritumus utilizācijai.',
              },
              {
                icon: Package,
                title: 'Materiālu piegādātāji',
                body: 'Saņemiet ienesīgus pasūtījumus no lielākas klientu bāzes un palieliniet sava karjera vai ražotnes apgrozījumu.',
              },
              {
                icon: Recycle,
                title: 'Atkritumu apsaimniekotāji',
                body: 'Saņemiet tikai profesionālus pieprasījumus un pasūtījumus, kas ievēro visas normatīvo aktu prasības atkritumu pārvaldībā.',
              },
              {
                icon: Truck,
                title: 'Pārvadātāji',
                body: 'Atrodiet braucienus mūsu transporta biržā — šoferi var izmantot aplikāciju savu maršrutu pārvaldībai.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-white border border-border rounded-3xl p-10 flex flex-col gap-5 shadow-sm"
              >
                <div className="p-4 bg-neutral-50 w-fit rounded-2xl border border-border">
                  <Icon className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-medium tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 p-8 bg-white border border-border rounded-3xl text-center">
            <p className="text-xl font-medium tracking-tight">
              No pasūtījuma līdz piegādes dokumentam — 100% digitāli.
            </p>
            <p className="text-muted-foreground font-light mt-2">
              Efektīvāki procesi, mazāk administratīvā darba, mazāk papīru un zemākas izmaksas.
            </p>
          </div>
        </Container>
      </section>

      {/* ── 4. APP TOUR ── */}
      <section className="w-full bg-white border-t border-border">
        <Container className="py-24">
          <div className="flex flex-col items-center text-center gap-3 mb-16">
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">
              Par aplikāciju
            </p>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight">
              Uzziniet, cik vienkārši darbojas Bilt.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: ShoppingCart,
                step: '01',
                title: 'Pirkt būvmateriālus',
                body: 'Atveriet katalogu, izvēlieties materiālu un daudzumu, norādiet piegādes adresi — cenas no reģionālajiem piegādātājiem uzreiz.',
              },
              {
                icon: PackageOpen,
                step: '02',
                title: 'Pārdot būvmateriālus',
                body: 'Reģistrējieties kā piegādātājs, publicējiet savus materiālus un saņemiet pasūtījumus no platformas visā Latvijā.',
              },
              {
                icon: Navigation,
                step: '03',
                title: 'Pārņemt pārvadājumus',
                body: 'Skatiet pieejamos braucienus, apstipriniet darbu, izpildiet piegādi un saņemiet samaksu — viss caur aplikāciju.',
              },
            ].map(({ icon: Icon, step, title, body }) => (
              <div
                key={title}
                className="border border-border rounded-3xl p-10 flex flex-col gap-5"
              >
                <div className="flex items-center justify-between">
                  <div className="p-4 bg-neutral-50 w-fit rounded-2xl border border-border">
                    <Icon className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="text-4xl font-black text-neutral-100 tabular-nums">{step}</span>
                </div>
                <h3 className="text-xl font-medium tracking-tight">{title}</h3>
                <p className="text-muted-foreground font-light leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── 5. NETWORK STATS ── */}
      <section className="w-full bg-neutral-50 border-t border-border">
        <Container className="py-24">
          <div className="flex flex-col items-center text-center gap-4 mb-16">
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">
              Pievienojieties Bilt tīklam
            </p>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tighter leading-tight">
              Kustīgo un darītāju tīkls.
            </h2>
            <p className="text-lg text-muted-foreground font-light max-w-xl">
              Kļūstiet par daļu no Latvijas vadošā celtniecības loģistikas tīkla un izmantojiet Bilt
              platformas priekšrocības.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { stat: '500+', label: 'Materiālu piegādātāji un atkritumu pieņēmēji' },
              { stat: '200+', label: 'Partnerpārvadātāji' },
              { stat: '1 000+', label: 'Transportlīdzekļi tīklā' },
            ].map(({ stat, label }) => (
              <div
                key={label}
                className="bg-white border border-border rounded-3xl p-10 text-center"
              >
                <p className="text-5xl font-black tracking-tighter text-foreground">{stat}</p>
                <p className="text-muted-foreground font-light mt-3 text-sm">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <CTAButton href="/register" variant="primary" size="lg">
              Reģistrēties <ArrowRight className="w-5 h-5" />
            </CTAButton>
            <CTAButton href="/login" variant="outline" size="lg">
              Pieslēgties
            </CTAButton>
          </div>
        </Container>
      </section>

      {/* ── 6. LINKS ── */}
      <section className="w-full bg-white border-t border-border">
        <Container className="py-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          {[
            {
              label: 'Par Bilt',
              href: '/about',
              cta: 'Uzzināt vairāk →',
              body: 'Uzziniet, kas mēs esam un uz kurieni mēs virzāmies.',
            },
            {
              label: 'Karjera',
              href: '/careers',
              cta: 'Atvērtās pozīcijas →',
              body: 'Pievienojieties komandai, kas veido celtniecības nozares nākotni.',
            },
            {
              label: 'Sazināties',
              href: '/contact',
              cta: 'Rakstīt mums →',
              body: 'Jautājumi? Sazinieties ar mūsu komandu vai lokālo ekspertu.',
            },
          ].map(({ label, href, cta, body }) => (
            <div key={label} className="flex flex-col gap-3 p-8 border border-border rounded-3xl">
              <p className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">
                {label}
              </p>
              <p className="text-muted-foreground font-light leading-relaxed text-sm">{body}</p>
              <Link
                href={href}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors mt-auto"
              >
                {cta}
              </Link>
            </div>
          ))}
        </Container>
      </section>

      {/* ── 7. FINAL CTA ── */}
      <section className="w-full py-24 md:py-32 bg-[#203728] text-white">
        <Container className="flex flex-col items-center text-center gap-8">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-white/40">
            Pievienojieties tīklam
          </p>
          <h2 className="text-5xl md:text-7xl font-medium tracking-tighter leading-none text-white max-w-3xl">
            Reģistrējieties Bilt šodien.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <CTAButton
              href="/register"
              variant="inverted"
              size="lg"
              className="bg-[#22c55e] text-white hover:bg-[#16a34a] shadow-none"
            >
              Reģistrēties <ArrowRight className="w-5 h-5" />
            </CTAButton>
            <CTAButton
              href="/login"
              variant="outline"
              size="lg"
              className="border border-white/20 text-white bg-transparent hover:bg-white/10 shadow-none"
            >
              Pieslēgties
            </CTAButton>
          </div>
        </Container>
      </section>
    </main>
  );
}
