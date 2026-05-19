import Link from 'next/link';
import { CheckCircle2, CalendarDays, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrderSuccessPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className="inline-flex items-center justify-center size-20 rounded-full bg-green-100 mb-6">
        <CheckCircle2 className="size-10 text-green-600" />
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight mb-3">Rezervācija saņemta!</h1>
      <p className="text-muted-foreground text-base leading-relaxed mb-8">
        Piegādātājs apstiprinās Jūsu rezervāciju tuvākajā laikā. Apstiprinājums tiks nosūtīts uz
        norādīto e-pastu un telefonu.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 text-left">
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
          <CalendarDays className="size-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Nākamais solis</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Jūs saņemsiet apstiprinājumu 2 darba stundu laikā
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
          <Phone className="size-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Jautājumi?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sazinieties ar mums: support@b3hub.lv
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild variant="outline">
          <Link href="/order/materials">Atpakaļ uz katalogu</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Mans konts</Link>
        </Button>
      </div>
    </div>
  );
}
