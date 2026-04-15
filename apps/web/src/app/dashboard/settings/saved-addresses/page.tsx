/**
 * Saved Addresses management page — /dashboard/settings/saved-addresses
 * List, add, edit, and delete saved delivery addresses.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, type SavedAddress, type CreateSavedAddressInput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/page-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MapPin, Star, Pencil, Trash2, Plus, Check, X } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authFetch<T>(endpoint: string, token: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

const EMPTY_FORM: CreateSavedAddressInput = {
  label: '',
  address: '',
  city: '',
  isDefault: false,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SavedAddressesPage() {
  const { token } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add / create form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<CreateSavedAddressInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CreateSavedAddressInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SavedAddress | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await authFetch<SavedAddress[]>('/saved-addresses', token);
      setAddresses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neizdevās ielādēt adreses');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!token) return;
    if (!addForm.label.trim() || !addForm.address.trim() || !addForm.city.trim()) {
      setAddError('Lūdzu aizpildiet visus obligātos laukus');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const created = await authFetch<SavedAddress>('/saved-addresses', token, {
        method: 'POST',
        body: JSON.stringify(addForm),
      });
      setAddresses((prev) => [created, ...prev]);
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Neizdevās pievienot adresi');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (addr: SavedAddress) => {
    setEditId(addr.id);
    setEditForm({
      label: addr.label,
      address: addr.address,
      city: addr.city,
      isDefault: addr.isDefault,
    });
    setSaveError('');
  };

  const handleSaveEdit = async () => {
    if (!token || !editId) return;
    if (!editForm.label.trim() || !editForm.address.trim() || !editForm.city.trim()) {
      setSaveError('Lūdzu aizpildiet visus obligātos laukus');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const updated = await authFetch<SavedAddress>(`/saved-addresses/${editId}`, token, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setAddresses((prev) => prev.map((a) => (a.id === editId ? updated : a)));
      setEditId(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Neizdevās saglabāt');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    try {
      const updated = await authFetch<SavedAddress>(`/saved-addresses/${id}/set-default`, token, {
        method: 'PATCH',
      });
      setAddresses((prev) => prev.map((a) => (a.id === id ? updated : { ...a, isDefault: false })));
    } catch {
      // Non-fatal
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await authFetch(`/saved-addresses/${deleteTarget.id}`, token, { method: 'DELETE' });
      setAddresses((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // Non-fatal — reload to get accurate state
      load();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <PageSpinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Saglabātās adreses"
        description="Pārvaldiet bieži izmantotās piegādes adreses."
        action={
          !showAddForm ? (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Pievienot adresi
            </Button>
          ) : undefined
        }
      />

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* ── Add form ── */}
      {showAddForm && (
        <Card className="shadow-none border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Jauna adrese
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="add-label">
                  Nosaukums <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-label"
                  value={addForm.label}
                  onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Piem. Mājas adrese"
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="add-city">
                  Pilsēta <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-city"
                  value={addForm.city}
                  onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Rīga"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-address">
                Adrese <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-address"
                value={addForm.address}
                onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Brīvības iela 1, Rīga, LV-1011"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="add-default"
                type="checkbox"
                checked={addForm.isDefault ?? false}
                onChange={(e) => setAddForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <Label htmlFor="add-default" className="cursor-pointer text-sm font-normal">
                Iestatīt kā noklusējuma adresi
              </Label>
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setAddForm(EMPTY_FORM);
                  setAddError('');
                }}
              >
                Atcelt
              </Button>
              <Button onClick={handleAdd} disabled={adding}>
                {adding ? 'Saglabā...' : 'Saglabāt'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Address list ── */}
      {addresses.length === 0 && !showAddForm ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Nav saglabātu adrešu</p>
            <p className="text-xs text-muted-foreground/70">
              Pievienojiet bieži izmantotās adreses, lai paātrinātu pasūtījumu noformēšanu.
            </p>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Pievienot pirmo adresi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {addresses.map((addr) => (
            <Card key={addr.id} className="shadow-none">
              <CardContent className="px-5 py-4">
                {editId === addr.id ? (
                  // ── Inline edit form ──
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nosaukums</Label>
                        <Input
                          value={editForm.label}
                          onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Pilsēta</Label>
                        <Input
                          value={editForm.city}
                          onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Adrese</Label>
                      <Input
                        value={editForm.address}
                        onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditId(null);
                          setSaveError('');
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {saving ? 'Saglabā...' : 'Saglabāt'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // ── Normal display row ──
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{addr.label}</p>
                        {addr.isDefault && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full bg-primary/10 text-primary px-2 py-0.5">
                            <Star className="h-2.5 w-2.5" />
                            Noklusējums
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {addr.address}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{addr.city}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!addr.isDefault && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-amber-500"
                          title="Iestatīt kā noklusējumu"
                          onClick={() => handleSetDefault(addr.id)}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        title="Rediģēt"
                        onClick={() => openEdit(addr)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Dzēst"
                        onClick={() => setDeleteTarget(addr)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Delete confirm dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dzēst adresi?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Adrese &quot;{deleteTarget?.label}&quot; tiks neatgriezeniski dzēsta.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Atcelt
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Dzēš...' : 'Dzēst'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
