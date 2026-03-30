import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/sections/Hero';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { Materials } from '@/components/sections/Materials';
import { B3Fields } from '@/components/sections/B3Fields';
import { ConstructionServices } from '@/components/sections/ConstructionServices';
import { Features } from '@/components/sections/Features';
import { Stats } from '@/components/sections/Stats';
import { CTA } from '@/components/sections/CTA';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        {/* 1. Above the fold — who we are + primary CTA */}
        <Hero />

        {/* 2. Three roles — Buyer / Seller / Carrier */}
        <HowItWorks />

        {/* 3. Physical materials we supply */}
        <Materials />

        {/* 4. Physical B3 Field network — the moat */}
        <B3Fields />

        {/* 5. Construction services (earthworks, demolition, landscaping) */}
        <ConstructionServices />

        {/* 6. Platform features */}
        <Features />

        {/* 7. Trust numbers */}
        <Stats />

        {/* 8. Final CTA */}
        <CTA />
      </main>
      <Footer />
    </>
  );
}
