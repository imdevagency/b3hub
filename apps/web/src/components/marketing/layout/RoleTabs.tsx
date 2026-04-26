'use client';

import { useState } from 'react';
import { Home, Building2, Truck, Pickaxe, Check, ArrowRight } from 'lucide-react';
import { CTAButton } from '@/components/marketing/ui/cta-button';
import Link from 'next/link';

type Role = 'b2c' | 'b2b' | 'driver' | 'supplier';

export function RoleTabs() {
  const [activeRole, setActiveRole] = useState<Role>('b2c');

  const roles = [
    { id: 'b2c', label: 'Privātpersona', icon: Home },
    { id: 'b2b', label: 'Uzņēmums', icon: Building2 },
    { id: 'driver', label: 'Šoferis', icon: Truck },
    { id: 'supplier', label: 'Karjers', icon: Pickaxe },
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
        {/* B2C */}
        {activeRole === 'b2c' && (
          <div className="bg-secondary/30 rounded-3xl p-10 md:p-16 flex flex-col md:flex-row gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="flex-1 flex flex-col gap-6 max-w-2xl text-left">
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Privātpersona vai mazais pasūtītājs
              </p>
              <h3 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight">
                Grants vai smiltis
                <br />
                bez zvaniem un e-pastiem.
              </h3>
              <ul className="flex flex-col gap-4">
                {[
                  'Cenas no reģionālajiem karjeriem — redzamas uzreiz',
                  'GPS izsekošana — zini minūtē, kad auto pie tevis būs',
                  'Maksā ar karti, saņem rēķinu automātiski',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-lg text-muted-foreground">
                    <div className="p-1 bg-background rounded-full shrink-0 shadow-xs">
                      <Check className="w-4 h-4 text-foreground" strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <CTAButton href={'/order'} variant="primary" size="lg" className="w-fit text-base">
                  Pasūtīt tagad <ArrowRight className="w-5 h-5 ml-1.5" />
                </CTAButton>
              </div>
            </div>
          </div>
        )}

        {/* B2B */}
        {activeRole === 'b2b' && (
          <div className="bg-foreground text-background rounded-3xl p-10 md:p-16 flex flex-col md:flex-row gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="flex-1 flex flex-col gap-6 max-w-2xl text-left">
              <p className="text-sm font-bold tracking-widest uppercase text-background/50">
                Būvniecības uzņēmums vai kontraktors
              </p>
              <h3 className="text-4xl md:text-5xl font-medium tracking-tight leading-tight text-background">
                Centralizē visu
                <br />
                celtniecības loģistiku.
              </h3>
              <ul className="flex flex-col gap-4">
                {[
                  'Ietvara līgumi un projektu apjoma kontrole',
                  'Komantas konti ar lomām un atļau pārvaldību',
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
                <CTAButton
                  href={'/register'}
                  variant="inverted"
                  size="lg"
                  className="w-fit text-base"
                >
                  Reģistrēt uzņēmumu <ArrowRight className="w-5 h-5 ml-1.5" />
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
      </div>
    </div>
  );
}
