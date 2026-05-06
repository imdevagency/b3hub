/**
 * Construction — DPR Templates
 * /dashboard/construction/dpr-templates
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getDprTemplates, deleteDprTemplate, type DprTemplate } from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollText, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n);
}

export default function DprTemplatesPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  const [templates, setTemplates] = useState<DprTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setTemplates(await getDprTemplates(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDprTemplate(deleteId, token);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="DPR Veidnes"
        description="Dienas darbu atskaitīšu veidnes ātrai ievadei"
        icon={ScrollText}
        actions={
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nav veidņu"
          description="Veidnes tiek izveidotas automātiski no dienas atskaitēm."
        />
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => {
            const isOpen = expanded.has(tpl.id);
            const lineTotal = tpl.lines.reduce((s, l) => s + l.quantity * l.unitRate, 0);
            return (
              <Card key={tpl.id}>
                <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleExpand(tpl.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div>
                        <CardTitle className="text-base">{tpl.name}</CardTitle>
                        {tpl.project && (
                          <p className="text-xs text-muted-foreground mt-0.5">{tpl.project.name}</p>
                        )}
                      </div>
                      {!tpl.project && (
                        <Badge variant="secondary" className="ml-2">
                          Globāla
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {tpl.lines.length} rindas · {fmtEur(lineTotal)}
                      </span>
                      {tpl.project && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(tpl.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isOpen && tpl.lines.length > 0 && (
                  <CardContent className="p-0 border-t">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left p-3 font-medium">Apraksts</th>
                          <th className="text-left p-3 font-medium">Kods</th>
                          <th className="text-right p-3 font-medium">Daudz.</th>
                          <th className="text-left p-3 font-medium">Vienība</th>
                          <th className="text-right p-3 font-medium">Likme</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tpl.lines.map((l) => (
                          <tr key={l.id} className="border-b">
                            <td className="p-3">{l.description}</td>
                            <td className="p-3 font-mono text-muted-foreground">{l.costCode}</td>
                            <td className="p-3 text-right">{l.quantity}</td>
                            <td className="p-3">{l.unit}</td>
                            <td className="p-3 text-right font-mono">{fmtEur(l.unitRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arhivēt veidni?</AlertDialogTitle>
            <AlertDialogDescription>
              Veidne tiks deaktivēta un vairs nebūs redzama.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Atcelt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Arhivē...' : 'Arhivēt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
