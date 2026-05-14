'use client';

import { useEquipmentServices } from '@/lib/use-equipment-services';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { Settings2, HardHat, Clock } from 'lucide-react';

export default function EquipmentCatalogPage() {
  const equipmentServices = useEquipmentServices();
  const items = equipmentServices.map((svc) => ({
    id: svc.type,
    href: `/dashboard/order/equipment/${svc.type.toLowerCase().replace(/_/g, '-')}`,
    label: svc.label,
    description: svc.description,
    priceHint: `no €${svc.priceFrom}/${svc.unitLabel}/d.`,
    icon: svc.Icon,
    searchString: `${svc.label} ${svc.description}`,
  }));

  const infoStrip = (
    <div className="rounded-3xl bg-muted/30 border border-border/40 p-8 flex flex-col md:flex-row gap-8 md:gap-12">
      <div className="flex items-start gap-4">
        <Settings2 className="size-8 shrink-0 text-foreground mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="font-bold text-foreground">Regulāra apkope iekļauta</p>
          <p className="text-sm text-muted-foreground mt-1">
            Visa tehnika ir pārbaudīta un gatava darbam.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <Clock className="size-8 shrink-0 text-foreground mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="font-bold text-foreground">Ātra piegāde uz objektu</p>
          <p className="text-sm text-muted-foreground mt-1">
            Piegādāsim tehniku vajadzīgajā laikā un vietā.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <HardHat className="size-8 shrink-0 text-foreground mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="font-bold text-foreground">Profesionāla palīdzība</p>
          <p className="text-sm text-muted-foreground mt-1">
            Palīdzēsim izvēlēties piemērotāko tehniku jūsu projektam.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <CatalogGrid
      title="Tehnikas noma"
      subtitle="Ekskavatori, demperi, kompaktori un cita tehnika celtniecībai."
      items={items}
      breadcrumbs={[{ label: 'Pasūtījumi', href: '/dashboard/order' }, { label: 'Tehnikas noma' }]}
      infoStrip={infoStrip}
    />
  );
}
