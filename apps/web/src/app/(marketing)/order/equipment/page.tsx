'use client';

import { useEquipmentServices } from '@/lib/use-equipment-services';
import { Settings2, HardHat, Clock } from 'lucide-react';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';

export default function EquipmentCatalogPage() {
  const equipmentServices = useEquipmentServices();
  const items = equipmentServices.map((svc) => ({
    id: svc.type,
    href: `/order/equipment/${svc.type.toLowerCase().replace(/_/g, '-')}`,
    label: svc.label,
    description: svc.description,
    priceHint: `no €${svc.priceFrom} / ${svc.unitLabel}`,
    icon: svc.Icon,
    searchString: `${svc.label} ${svc.description}`.toLowerCase(),
  }));

  const infoStrip = (
    <div className="rounded-3xl bg-muted/40 border border-border/60 p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-10 mt-10">
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 h-12 w-12 items-center justify-center rounded-2xl border border-border/50 bg-background shadow-sm">
          <Settings2 className="size-5 text-foreground" strokeWidth={1.5} />
        </div>
        <div className="pt-0.5">
          <p className="font-bold text-foreground">Regulāra apkope iekļauta</p>
          <p className="text-sm text-muted-foreground mt-1">
            Visa tehnika ir pārbaudīta un gatava darbam.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 h-12 w-12 items-center justify-center rounded-2xl border border-border/50 bg-background shadow-sm">
          <Clock className="size-5 text-foreground" strokeWidth={1.5} />
        </div>
        <div className="pt-0.5">
          <p className="font-bold text-foreground">Ātra piegāde uz objektu</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sistēma vienmēr atrod Jums tuvāko tehniku.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 h-12 w-12 items-center justify-center rounded-2xl border border-border/50 bg-background shadow-sm">
          <HardHat className="size-5 text-foreground" strokeWidth={1.5} />
        </div>
        <div className="pt-0.5">
          <p className="font-bold text-foreground">Gatavs strādāt</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cena uzreiz redzama. Bez reģistrācijas pārbaudes un zvaniem.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <CatalogGrid
      title="Tehnikas noma"
      subtitle="Izvēlieties tehnikas veidu — platforma atradīs lētākos pieejamos variantus jūsu tuvumā."
      items={items}
      breadcrumbs={[{ label: 'Pakalpojumi', href: '/order' }, { label: 'Tehnika' }]}
      infoStrip={infoStrip}
    />
  );
}
