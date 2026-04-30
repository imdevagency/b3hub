/**
 * B3 Construction — Labour Hours Summary
 * /dashboard/b3-construction/labour-hours
 *
 * Shows per-employee DPR hours/quantities aggregated by project and month.
 * Replaces the "who worked where this month" timesheets kept in Google Sheets.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adminGetEmployees,
  adminGetEmployeeHours,
  type ConstructionEmployee,
  type EmployeeHoursLine,
} from '@/lib/api/admin';

function fmtEur(n: number) {
  return `€${n.toLocaleString('lv-LV', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtQty(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

interface EmployeeSummary {
  employee: ConstructionEmployee;
  lines: EmployeeHoursLine[];
  totalQuantity: number;
  totalCost: number;
  byProject: Record<string, { name: string; quantity: number; cost: number }>;
}

export default function LabourHoursPage() {
  const { token } = useAuth();

  const [employees, setEmployees] = useState<ConstructionEmployee[]>([]);
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Month filter
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const empRes = await adminGetEmployees(token, { activeOnly: true, limit: 200 });
      setEmployees(empRes.data);

      const results = await Promise.all(empRes.data.map((e) => adminGetEmployeeHours(e.id, token)));

      const monthStart = new Date(`${filterMonth}-01`);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

      const built: EmployeeSummary[] = results.map((res, i) => {
        const filtered = res.lines.filter((l) => {
          const d = new Date(l.report.reportDate);
          return d >= monthStart && d <= monthEnd;
        });

        const byProject: Record<string, { name: string; quantity: number; cost: number }> = {};
        let totalQty = 0;
        let totalCost = 0;
        for (const l of filtered) {
          const pid = l.report.project.id;
          if (!byProject[pid]) {
            byProject[pid] = { name: l.report.project.name, quantity: 0, cost: 0 };
          }
          byProject[pid].quantity += l.quantity;
          byProject[pid].cost += l.totalCost;
          totalQty += l.quantity;
          totalCost += l.totalCost;
        }

        return {
          employee: empRes.data[i],
          lines: filtered,
          totalQuantity: totalQty,
          totalCost,
          byProject,
        };
      });

      setSummaries(built.filter((s) => s.totalQuantity > 0 || s.lines.length === 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token, filterMonth]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const rows: string[][] = [
      ['Darbinieks', 'Loma', 'Projekts', 'Stundas / Daudzums', 'Izmaksas (€)'],
    ];
    for (const s of summaries) {
      const name = `${s.employee.firstName} ${s.employee.lastName}`;
      if (Object.keys(s.byProject).length === 0) {
        rows.push([name, s.employee.role ?? '', '—', '0', '0']);
      }
      for (const [, proj] of Object.entries(s.byProject)) {
        rows.push([
          name,
          s.employee.role ?? '',
          proj.name,
          fmtQty(proj.quantity),
          proj.cost.toFixed(2),
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darba_laiks_${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalHours = summaries.reduce((s, e) => s + e.totalQuantity, 0);
  const totalCost = summaries.reduce((s, e) => s + e.totalCost, 0);
  const activeCount = summaries.filter((s) => s.totalQuantity > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Darba laiks"
        description="Darbinieku stundas un izmaksas no DPR atskaitēm"
        action={
          <div className="flex items-center gap-2">
            <input
              type="month"
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={exportCsv}
              disabled={summaries.length === 0}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Aktīvi darbinieki
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-xs text-gray-400 mt-0.5">ar DPR ierakstiem mēnesī</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Kopā stundas / vienības
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              {fmtQty(totalHours)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">no apstiprinātajiem DPR</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Darba izmaksas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtEur(totalCost)}</div>
            <div className="text-xs text-gray-400 mt-0.5">daudzums × likme</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Ielādē…</div>
      ) : summaries.length === 0 ? (
        <div className="rounded-lg border bg-white py-16 text-center text-sm text-gray-400">
          Nav DPR datu izvēlētajā mēnesī
        </div>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Darbinieks</TableHead>
                <TableHead>Loma</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead className="text-right">Daudzums (h)</TableHead>
                <TableHead className="text-right">Izmaksas</TableHead>
                <TableHead className="text-right">Vidēji / h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((s) => {
                const isExpanded = expanded.has(s.employee.id);
                const projectList = Object.entries(s.byProject);
                return (
                  <>
                    <TableRow
                      key={s.employee.id}
                      className={projectList.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}
                      onClick={() => projectList.length > 0 && toggleExpand(s.employee.id)}
                    >
                      <TableCell className="text-gray-400">
                        {projectList.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">
                        {s.employee.firstName} {s.employee.lastName}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {s.employee.role ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            s.employee.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-500'
                          }
                        >
                          {s.employee.active ? 'Aktīvs' : 'Neaktīvs'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {s.totalQuantity > 0 ? fmtQty(s.totalQuantity) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.totalCost > 0 ? fmtEur(s.totalCost) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {s.totalQuantity > 0
                          ? `€${(s.totalCost / s.totalQuantity).toFixed(2)}`
                          : '—'}
                      </TableCell>
                    </TableRow>

                    {isExpanded &&
                      projectList.map(([pid, proj]) => (
                        <TableRow key={pid} className="bg-gray-50 text-sm">
                          <TableCell />
                          <TableCell colSpan={2} className="pl-8 text-gray-600">
                            ↳ {proj.name}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right font-mono text-gray-600">
                            {fmtQty(proj.quantity)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-gray-600">
                            {fmtEur(proj.cost)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                  </>
                );
              })}

              {/* Totals row */}
              <TableRow className="bg-gray-50 font-semibold border-t-2">
                <TableCell />
                <TableCell colSpan={3}>Kopā</TableCell>
                <TableCell className="text-right font-mono">{fmtQty(totalHours)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEur(totalCost)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
