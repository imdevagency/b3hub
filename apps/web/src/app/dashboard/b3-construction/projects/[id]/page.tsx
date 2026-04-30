/**
 * B3 Construction — Projekta detaļas
 * /dashboard/b3-construction/projects/[id]
 *
 * Full project view: financials, orders, sites, framework contracts.
 * Admin can update project status.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetConstructionProjectById,
  adminUpdateConstructionProject,
  type AdminConstructionProjectDetail,
  type ConstructionProjectStatus,
} from '@/lib/api/admin';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Euro,
  FolderKanban,
  MapPin,
  Package,
  TrendingUp,
  Truck,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ConstructionProjectStatus, string> = {
  PLANNING: 'Plānošana',
  ACTIVE: 'Aktīvs',
  COMPLETED: 'Pabeigts',
  ON_HOLD: 'Apturēts',
};

const STATUS_VARIANTS: Record<
  ConstructionProjectStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  PLANNING: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
  ON_HOLD: 'destructive',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida',
  CONFIRMED: 'Apstiprināts',
  IN_PROGRESS: 'Procesā',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const ORDER_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  IN_PROGRESS: 'default',
  DELIVERED: 'outline',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Melnraksts',
  ACTIVE: 'Aktīvs',
  COMPLETED: 'Pabeigts',
  SUSPENDED: 'Apturēts',
  CANCELLED: 'Atcelts',
};

function formatEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function parseWasteTypes(raw: string | null): string {
  if (!raw) return '—';
  try {
    const arr: string[] = JSON.parse(raw);
    const labels: Record<string, string> = {
      CONCRETE: 'Betons',
      BRICK: 'Ķieģeļi',
      WOOD: 'Koksne',
      METAL: 'Metāls',
      PLASTIC: 'Plastmasa',
      SOIL: 'Grunts',
      MIXED: 'Jaukti',
      HAZARDOUS: 'Bīstami',
    };
    return arr.map((t) => labels[t] ?? t).join(', ');
  } catch {
    return raw;
  }
}

const TRANSPORT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Pieejams',
  ASSIGNED: 'Piešķirts',
  ACCEPTED: 'Apstiprināts',
  EN_ROUTE_PICKUP: 'Brauc uz iekr.',
  AT_PICKUP: 'Iekraušanā',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Brauc uz izkr.',
  AT_DELIVERY: 'Izkraušanā',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
  DELIVERY_REFUSED: 'Atteikts',
};

const TRANSPORT_STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  AVAILABLE: 'secondary',
  ASSIGNED: 'secondary',
  ACCEPTED: 'default',
  EN_ROUTE_PICKUP: 'default',
  AT_PICKUP: 'default',
  LOADED: 'default',
  EN_ROUTE_DELIVERY: 'default',
  AT_DELIVERY: 'default',
  DELIVERED: 'outline',
  CANCELLED: 'destructive',
  DELIVERY_REFUSED: 'destructive',
};

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = Math.min((spent / budget) * 100, 100);
  const over = spent > budget;
  const warn = pct >= 80;
  return (
    <div className="mt-2 space-y-1">
      <Progress
        value={pct}
        className={`h-1.5 ${over ? '[&>div]:bg-red-500' : warn ? '[&>div]:bg-amber-500' : ''}`}
      />
      <p
        className={`text-xs ${over ? 'text-red-600 font-medium' : warn ? 'text-amber-600' : 'text-muted-foreground'}`}
      >
        {pct.toFixed(0)}% no budžeta{over ? ' — PĀRTĒRĒTS' : ''}
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ConstructionProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [project, setProject] = useState<AdminConstructionProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const data = await adminGetConstructionProjectById(id, token);
      setProject(data);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (status: string) => {
    if (!token || !project) return;
    setUpdatingStatus(true);
    try {
      await adminUpdateConstructionProject(
        id,
        { status: status as ConstructionProjectStatus },
        token,
      );
      setProject((prev) =>
        prev ? { ...prev, status: status as ConstructionProjectStatus } : prev,
      );
    } catch {
      // silently fail — status reverts
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) return <PageSpinner />;

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Projekts" />
        <EmptyState icon={FolderKanban} title="Projekts nav atrasts" />
      </div>
    );
  }

  const disposalOrders = project.orders.filter((o) => o.category === 'DISPOSAL');
  const materialOrders = project.orders.filter((o) => o.category !== 'DISPOSAL');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.name}
        description={
          [project.clientName, project.siteAddress].filter(Boolean).join(' · ') || undefined
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/b3-construction/projects')}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Atpakaļ
            </Button>
            <Select
              value={project.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANNING">Plānošana</SelectItem>
                <SelectItem value="ACTIVE">Aktīvs</SelectItem>
                <SelectItem value="ON_HOLD">Apturēts</SelectItem>
                <SelectItem value="COMPLETED">Pabeigts</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant={STATUS_VARIANTS[project.status]}>{STATUS_LABELS[project.status]}</Badge>
          </div>
        }
      />

      {/* Financials */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Euro}
          label="Līguma vērtība"
          value={formatEur(project.contractValue)}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Materiālu izmaksas</p>
                <p className="text-xl font-semibold leading-tight">
                  {formatEur(project.materialCosts)}
                </p>
                {project.budgetAmount != null && project.budgetAmount > 0 && (
                  <BudgetBar spent={project.materialCosts} budget={project.budgetAmount} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <StatCard
          icon={TrendingUp}
          label="Bruto peļņa"
          value={formatEur(project.grossMargin)}
          sub={`${project.marginPct.toFixed(1)}% no līguma`}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          icon={FolderKanban}
          label="Pasūtījumi"
          value={String(project.orderCount)}
          sub={`${project.transportJobCount} transporta darbi`}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
      </div>

      {/* Meta row */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{project.company.name}</span>
            </div>
            {project.siteAddress && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{project.siteAddress}</span>
              </div>
            )}
            {project.startDate && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(project.startDate), 'dd.MM.yyyy')}
                  {project.endDate ? ` – ${format(new Date(project.endDate), 'dd.MM.yyyy')}` : ''}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                Izv.: {project.createdBy.firstName} {project.createdBy.lastName}
              </span>
            </div>
          </div>
          {project.description && (
            <>
              <Separator className="my-3" />
              <p className="text-sm text-muted-foreground">{project.description}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Material orders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-muted-foreground" />
            Materiālu pasūtījumi
            <Badge variant="secondary" className="ml-auto">
              {materialOrders.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {materialOrders.length === 0 ? (
            <div className="py-8">
              <EmptyState icon={Package} title="Nav materiālu pasūtījumu" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Materiāls</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead>Piegādes datums</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell className="text-sm">
                      {o.items.length > 0
                        ? o.items.map((i) => i.material?.name ?? '—').join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ORDER_STATUS_VARIANTS[o.status] ?? 'secondary'}>
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatEur(o.total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.deliveryDate ? format(new Date(o.deliveryDate), 'dd.MM.yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Disposal / waste orders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Atkritumu izvešana
            <Badge variant="secondary" className="ml-auto">
              {disposalOrders.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {disposalOrders.length === 0 ? (
            <div className="py-8">
              <EmptyState icon={Truck} title="Nav atkritumu izvešanas pasūtījumu" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Atkritumu veids</TableHead>
                  <TableHead>Apjoms</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead>Datums</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disposalOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell className="text-sm">{parseWasteTypes(o.wasteTypes)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.disposalVolume ? `${o.disposalVolume} m³` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ORDER_STATUS_VARIANTS[o.status] ?? 'secondary'}>
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatEur(o.total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.deliveryDate ? format(new Date(o.deliveryDate), 'dd.MM.yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Framework contracts */}
      {project.frameworkContracts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Ietvarlīgumi
              <Badge variant="secondary" className="ml-auto">
                {project.frameworkContracts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Virsraksts</TableHead>
                  <TableHead>Piegādātājs</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Vērtība</TableHead>
                  <TableHead>Beigu datums</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.frameworkContracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.contractNumber}</TableCell>
                    <TableCell className="text-sm font-medium">{c.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.supplier?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {c.totalValue != null ? formatEur(c.totalValue) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.endDate ? format(new Date(c.endDate), 'dd.MM.yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transport jobs */}
      {project.transportJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Transporta darbi
              <Badge variant="secondary" className="ml-auto">
                {project.transportJobs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Krava</TableHead>
                  <TableHead>Maršruts</TableHead>
                  <TableHead>Vadītājs</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Likme</TableHead>
                  <TableHead>Datums</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.transportJobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-sm">{j.jobNumber}</TableCell>
                    <TableCell className="text-sm">
                      {j.cargoType}
                      {j.cargoWeight != null && (
                        <span className="ml-1 text-muted-foreground">· {j.cargoWeight} t</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {j.pickupCity} → {j.deliveryCity}
                    </TableCell>
                    <TableCell className="text-sm">
                      {j.driver ? (
                        `${j.driver.firstName} ${j.driver.lastName}`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TRANSPORT_STATUS_VARIANTS[j.status] ?? 'secondary'}>
                        {TRANSPORT_STATUS_LABELS[j.status] ?? j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatEur(j.rate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(j.pickupDate), 'dd.MM.yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sites */}
      {project.sites.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Objekta vietas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {project.sites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{site.label}</span>
                    <span className="ml-2 text-muted-foreground">{site.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {site.type === 'LOADING'
                        ? 'Iekraušana'
                        : site.type === 'UNLOADING'
                          ? 'Izkraušana'
                          : 'Abi'}
                    </Badge>
                    {site.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Galvenais
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
