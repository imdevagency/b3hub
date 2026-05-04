'use client';

import { useState } from 'react';
import { HardHat, Truck, Pickaxe, Recycle, Check, ArrowRight } from 'lucide-react';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import Link from 'next/link';

type Role = 'constructor' | 'driver' | 'supplier' | 'recycler';

export function RoleTabs() {
  const [activeRole, setActiveRole] = useState<Role>('constructor');

  const roles = [
    { id: 'constructor', label: 'Būvnieks', icon: HardHat },
    { id: 'driver', label: 'Šoferis', icon: Truck },
    { id: 'supplier', label: 'Piegādātājs', icon: Pickaxe },
    { id: 'recycler', label: 'Pārstrādātājs', icon: Recycle },
  ] as const;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Tab Selectors */}
      <div className="flex flex-wrap justify-center gap-2 mb-10 p-2 bg-secondary/20 rounded-full border border-border/50">
        {roles.map((r) => {
          const Icon = r.icon;
          const isActive = activeRole === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setActiveRole(r.id)}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-semibold tracking-wide transition-all ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 1.5} />
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="w-full">
        {/* Constructor */}
        {activeRole === 'constructor' && (
          <div className="bg-foreground text-background rounded-3xl p-10 md:p-16 flex flex-col md:flex-row gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="flex-1 flex flex-col gap-6 max-w-2xl text-left">
              <p className="text-sm font-bold tracking-widest uppercase text-background/50">
                Privātpersona, kontraktors vai būvniecības uzņēmums
              </p>
              <h3 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight text-background">
                Pasūti materiālus
                <br />
                bez zvaniem un e-pastiem.
              </h3>
              <ul className="flex flex-col gap-4">
                {[
                  'Cenas no reģionālajiem karjeriem — redzamas uzreiz',
                  'Ietvara līgumi un projektu apjoma kontrole',
                  'Automātiskie PVN rēķini un ikmēneša kopsavilkumi',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-lg text-background/80">
                    <div className="p-1 bg-background/20 rounded-full shrink-0">
                      <Check className="w-4 h-4 text-background" strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-4 items-center">
                <CTAButton href={'/order'} variant="inverted" size="lg" className="w-fit text-base">
                  Pasūtīt tagad <ArrowRight className="w-5 h-5 ml-1.5" />
                </CTAButton>
                <Link
                  href="/buvniekiem"
                  className="text-base text-background/50 hover:text-background/90 transition-colors font-medium"
                >
                  Lasīt vairāk →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Driver */}
        {activeRole === 'driver' && (
          <div className="bg-secondary/30 rounded-3xl p-10 md:p-16 flex flex-col md:flex-row gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="flex-1 flex flex-col gap-6 max-w-2xl text-left">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Pārvadātājs vai neatkarīgais šoferis
              </p>
              <h3 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight">
                Saņem pārvadājumus.
                <br />
                Pelni. Saņem naudu nākamajā dienā.
              </h3>
              <ul className="flex flex-col gap-4">
                {[
                  'Brīva darbu izvēle — nekādu saistību, nekādu dispečeru',
                  'Digitālie CMR un pavadzīmes — bez papīriem',
                  'Izmaksa nākamajā darba dienā pēc katras piegādes',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-lg text-muted-foreground">
                    <div className="p-1 bg-background rounded-full shrink-0 shadow-xs">
                      <Check className="w-4 h-4 text-foreground" strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-4 items-center">
                <CTAButton
                  href={'/parvadatajiem'}
                  variant="primary"
                  size="lg"
                  className="w-fit text-base"
                >
                  Sākt braukt <ArrowRight className="w-5 h-5 ml-1.5" />
                </CTAButton>
              </div>
            </div>
          </div>
        )}

        {/* Supplier */}
        {activeRole === 'supplier' && (
          <div className="bg-secondary/30 rounded-3xl p-10 md:p-16 flex flex-col md:flex-row gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="flex-1 flex flex-col gap-6 max-w-2xl text-left">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Karjers vai materiālu piegādātājs
              </p>
              <h3 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight">
                Pārdod materiālus
                <br />
                bez papīra un WhatsApp.
              </h3>
              <ul className="flex flex-col gap-4">
                {[
                  'Digitālais katalogs — rediģē cenas un pieejamību jebkurā brīdī',
                  'Pasūtījumi ienāk automātiski — ne pa telefonu vai WhatsApp',
                  'Rēķini un dokumenti ģenerējas pēc katras piegādes',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-lg text-muted-foreground">
                    <div className="p-1 bg-background rounded-full shrink-0 shadow-xs">
                      <Check className="w-4 h-4 text-foreground" strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-4 items-center">
                <CTAButton
                  href={'/karjeriem'}
                  variant="primary"
                  size="lg"
                  className="w-fit text-base"
                >
                  Pievienoties tīklam <ArrowRight className="w-5 h-5 ml-1.5" />
                </CTAButton>
              </div>
            </div>
          </div>
        )}

        {/* Recycler */}
        {activeRole === 'recycler' && (
          <div className="bg-secondary/30 rounded-3xl p-10 md:p-16 flex flex-col md:flex-row gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="flex-1 flex flex-col gap-6 max-w-2xl text-left">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Būvgružu un atkritumu pārstrādes uzņēmums
              </p>
              <h3 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight">
                Pieņem būvgružus.
                <br />
                Izstādi cenas. Saņem pasūtījumus.
              </h3>
              <ul className="flex flex-col gap-4">
                {[
                  'Tiešsaistes rezervācija — klienti pierakstās paši bez zvaniem',
                  'Automātiskie pieņemšanas akti un nodošanas sertifikāti',
                  'Svara uzskaite un atkritumu žurnāls digitāli',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-lg text-muted-foreground">
                    <div className="p-1 bg-background rounded-full shrink-0 shadow-xs">
                      <Check className="w-4 h-4 text-foreground" strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-4 items-center">
                <CTAButton
                  href={'/register'}
                  variant="primary"
                  size="lg"
                  className="w-fit text-base"
                >
                  Reģistrēt uzņēmumu <ArrowRight className="w-5 h-5 ml-1.5" />
                </CTAButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
