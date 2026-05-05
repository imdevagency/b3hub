/**
 * Admin projects overview — /dashboard/admin/projects
 * Platform-wide view of all construction projects with waste declarations and material needs.
 */
'use client';

import { useEffect, useState } from 'react';
import { Building2, Recycle, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  adminGetAllProjects,
  type AdminProjectItem,
} from '@/lib/api';
import { fmtDate } from '@/lib/format';

const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Plānošana',
  ACTIVE: 'Aktīvs',
  COMPLETED: 'Pabeigts',
  ON_HOLD: 'Apturēts',
};

const PROJECT_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PLANNING: 'outline',
  ACTIVE: 'default',
  COMPLETED: 'secondary',
  ON_HOLD: 'destructive',
};

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons', BRICK: 'Ķieģeļi', WOOD: 'Koksne', METAL: 'Metāls',
  PLASTIC: 'Plastmasa', SOIL: 'Grunts', MIXED: 'Jaukti', HAZARDOUS: 'Bīstami',
  ASPHALT: 'Asfalta', GREEN_WASTE: 'Zaļais atkritums', WEEE: 'Elektronikas atkritumi',
  OIL_WASTE: 'Eļļas atkritumi', TIRES: 'Riepas', PACKAGING_WASTE: 'Iepakojuma atkritumi',
};

const MATERIAL_LABELS: Record<string, string> = {
  SAND: 'Smiltis', GRAVEL: 'Grants', STONE: 'Akmens', CONCRETE: 'Betons',
  SOIL: 'Grunts', RECYCLED_CONCRETE: 'RC betons', RECYCLED_SOIL: 'RC grunts',
  ASPHALT: 'Asfalta', CLAY: 'Māls', OTHER: 'Cits',
};

export default function AdminProjectsPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<AdminProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    adminGetAllProjects(token)
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [token]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.company.name.toLowerCase().includes(q) ||
      (p.siteAddress ?? '').toLowerCase().includes(q)
    );
  });

  // Summary stats
  const totalWasteDecls = projects.reduce((sum, p) => sum + p.wasteDeclarations.length, 0);
  const totalForSale = projects.reduce((sum, p) => sum + p.wasteDeclarations.filter((d) => d.willingToSell).length, 0);
  const totalMaterialNeeds = projects.reduce((sum, p) => sum + p.materialNeeds.length, 0);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projekti</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visi uzņēmumu projekti platformā ar atkritumu deklarācijām un materiālu vajadzībām.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-muted/40 p-2.5">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Projekti</p>
              <p className="text-2xl font-bold">{projects.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-muted/40 p-2.5">
              <Recycle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Atkritumu deklarācijas</p>
              <p className="text-2xl font-bold">{totalWasteDecls}</p>
              {totalForSale > 0 && (
                <p className="text-xs text-green-700 font-medium">{totalForSale} pārdošanai</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-muted/40 p-2.5">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Materiālu vajadzības</p>
              <p className="text-2xl font-bold">{totalMaterialNeeds}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Input
        placeholder="Meklēt pēc projekta, uzņēmuma vai adreses..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {/* Projects list */}
      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            {filtered.length} projekts(-i)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 divide-y divide-border/50">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nav rezultātu</p>
          )}
          {filtered.map((project) => {
            const isExpanded = expanded.has(project.id);
            return (
              <div key={project.id}>
                {/* Row */}
                <button
                  onClick={() => toggle(project.id)}
                  className="w-full flex items-start gap-3 py-3 px-2 hover:bg-muted/30 rounded-xl transition-colors text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{project.name}</span>
                      <Badge
                        variant={PROJECT_STATUS_VARIANT[project.status] ?? 'outline'}
                        className="text-[10px] h-4 px-1.5 rounded-full"
                      >
                        {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{project.company.name}{project.company.city ? ` · ${project.company.city}` : ''}</p>
                    {project.siteAddress && (
                      <p className="text-xs text-muted-foreground truncate">{project.siteAddress}</p>
                    )}
                    {(project.startDate || project.endDate) && (
                      <p className="text-xs text-muted-foreground">{fmtDate(project.startDate)} → {fmtDate(project.endDate)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {project.wasteDeclarations.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Recycle className="h-3.5 w-3.5" />
                        {project.wasteDeclarations.length}
                        {project.wasteDeclarations.some((d) => d.willingToSell) && (
                          <span className="text-green-700 font-medium">↗</span>
                        )}
                      </span>
                    )}
                    {project.materialNeeds.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {project.materialNeeds.length}
                      </span>
                    )}
                    <span>{project._count.orders} pas.</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="ml-7 mb-3 space-y-3">
                    {project.wasteDeclarations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                          <Recycle className="h-3.5 w-3.5" /> Atkritumi
                        </p>
                        <div className="space-y-1">
                          {project.wasteDeclarations.map((d) => (
                            <div key={d.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-muted/30">
                              <span className="font-medium">{WASTE_LABELS[d.wasteType] ?? d.wasteType}</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full">{d.estimatedTonnes} t</Badge>
                              {d.willingToSell && <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full border-green-500 text-green-700">Pārdot</Badge>}
                              <span className="text-muted-foreground">{fmtDate(d.availableFrom)} → {fmtDate(d.availableTo)}</span>
                              {d.notes && <span className="text-muted-foreground truncate max-w-50">{d.notes}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {project.materialNeeds.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                          <ShoppingCart className="h-3.5 w-3.5" /> Materiālu vajadzības
                        </p>
                        <div className="space-y-1">
                          {project.materialNeeds.map((n) => (
                            <div key={n.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-muted/30">
                              <span className="font-medium">{MATERIAL_LABELS[n.materialCategory] ?? n.materialCategory}</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full">{n.estimatedTonnes} t</Badge>
                              <span className="text-muted-foreground">{fmtDate(n.neededFrom)} → {fmtDate(n.neededTo)}</span>
                              {n.notes && <span className="text-muted-foreground truncate max-w-50">{n.notes}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {project.wasteDeclarations.length === 0 && project.materialNeeds.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nav deklarāciju vai vajadzību</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
