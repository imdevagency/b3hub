/**
 * Public order hub — /order
 *
 * Intent-first service picker: user selects the type of service they need,
 * then continues to the appropriate wizard where they can explore details and
 * pricing before being asked to create an account (Airbnb pattern).
 *
 * When ?address= is present (set by HeroAddressSearch), the address is shown
 * as a context chip and forwarded to each service via addressQuery.
 */
import { ShieldCheck, Clock, FileText, MapPin } from 'lucide-react';
import { Container } from '@/components/marketing/layout/Container';
import { OrderServiceGrid } from '@/components/order/OrderServiceGrid';

interface Props {
  searchParams: Promise<{ address?: string; lat?: string; lng?: string; city?: string }>;
}

export default async function OrderHubPage({ searchParams }: Props) {
  const sp = await searchParams;
  const address = sp.address ?? null;

  // Build the raw query string to thread through to service pages
  const addressQuery = address
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries({ address: sp.address, lat: sp.lat, lng: sp.lng, city: sp.city }).filter(
            ([, v]) => Boolean(v),
          ) as [string, string][],
        ),
      ).toString()
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Container className="py-16 md:py-32">
        <div className="mb-16">
          <h1 className="text-5xl md:text-[5rem] font-extrabold tracking-tighter text-foreground leading-[1.05]">
            Kas jums
            <br />
            nepieciešams?
          </h1>
          <p className="mt-8 text-xl font-medium text-muted-foreground leading-relaxed max-w-2xl">
            Pasūtiet celtniecības pakalpojumus un materiālus. Cenas redzamas uzreiz, pavadzīmes
            automātiski.
          </p>

          {address && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <span className="truncate max-w-xs">{address}</span>
            </div>
          )}
        </div>

        <OrderServiceGrid addressQuery={addressQuery} />

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
              Konteineri un materiāli — bez konta
            </h3>
            <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
              Konteineri, materiāli un utilizācija — pasūtiet ar telefona numuru, konts nav
              vajadzīgs. Transports pieejams uzņēmumiem ar kontu.
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
