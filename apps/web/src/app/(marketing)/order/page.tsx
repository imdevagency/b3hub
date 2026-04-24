/**
 * Public order hub — /order
 *
 * Intent-first service picker: user selects the type of service they need,
 * then continues to the appropriate wizard where they can explore details and
 * pricing before being asked to create an account (Airbnb pattern).
 */
import { ShieldCheck, Clock, FileText } from 'lucide-react';
import { Container } from '@/components/marketing/layout/Container';
import { OrderServiceGrid } from '@/components/order/OrderServiceGrid';

export default function OrderHubPage() {
  return (
    <div className="min-h-screen bg-background">
      <Container className="py-16 md:py-32 max-w-6xl">
        <div className="mb-16">
          <h1 className="text-5xl md:text-[5rem] font-extrabold tracking-tighter text-foreground leading-[1.05]">
            Ko jums
            <br />
            nepieciešams?
          </h1>
          <p className="mt-8 text-xl font-medium text-muted-foreground leading-relaxed max-w-2xl">
            Pasūtiet celtniecības pakalpojumus un materiālus. Cenas redzamas uzreiz, pavadzīmes
            automātiski.
          </p>
        </div>

        <OrderServiceGrid />

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-12 pt-16 border-t border-border/50 text-foreground">
          <div>
            <ShieldCheck className="size-9 mb-5 text-foreground" strokeWidth={1.5} />
            <h3 className="font-extrabold text-xl mb-2.5 tracking-tight">Caurspīdīga cena</h3>
            <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
              Pirms pasūtīšanas precīzi zināsiet, cik jāmaksā. Nekādu slēpto maksu.
            </p>
          </div>
          <div>
            <Clock className="size-9 mb-5 text-foreground" strokeWidth={1.5} />
            <h3 className="font-extrabold text-xl mb-2.5 tracking-tight">
              Bez liekas reģistrācijas
            </h3>
            <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
              Pasūtiet, norādot tikai adresi un numuru. Ja vēlaties, kontu var izveidot vēlāk.
            </p>
          </div>
          <div>
            <FileText className="size-9 mb-5 text-foreground" strokeWidth={1.5} />
            <h3 className="font-extrabold text-xl mb-2.5 tracking-tight">Viss dokumentēts</h3>
            <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
              Pavadzīmes top automātiski, un GPS izsekošana nodrošina caurskatāmību.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
