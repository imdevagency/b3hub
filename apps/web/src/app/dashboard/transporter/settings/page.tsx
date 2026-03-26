/**
 * Carrier Settings page — /dashboard/transporter/settings
 * Manage skip-hire pricing, service zones, and blocked availability dates.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type SkipSize,
  type CarrierPricing,
  type CarrierServiceZone,
  type CarrierBlockedDate,
  type CarrierRadiusSettings,
  getCarrierPricing,
  setCarrierPrice,
  deleteCarrierPrice,
  getCarrierZones,
  addCarrierZone,
  deleteCarrierZone,
  getCarrierBlockedDates,
  blockCarrierDate,
  unblockCarrierDate,
  getCarrierRadius,
  setCarrierRadius,
} from '@/lib/api/carrier-settings';
import { Trash2, Plus, RefreshCw, Check, X } from 'lucide-react';

// ─── Static config ─────────────────────────────────────────────────────────

const SKIP_SIZES: { value: SkipSize; label: string; volume: string }[] = [
  { value: 'MINI', label: 'Mini', volume: '2 m³' },
  { value: 'MIDI', label: 'Midi', volume: '4 m³' },
  { value: 'BUILDERS', label: 'Builders', volume: '6 m³' },
  { value: 'LARGE', label: 'Liels', volume: '8 m³' },
];

type Tab = 'pricing' | 'zones' | 'availability' | 'radius';

// ─── Pricing tab ───────────────────────────────────────────────────────────

function PricingTab({ token }: { token: string }) {
  const [rows, setRows] = useState<CarrierPricing[]>([]);
  const [editing, setEditing] = useState<Partial<Record<SkipSize, string>>>({});
  const [saving, setSaving] = useState<Partial<Record<SkipSize, boolean>>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCarrierPricing(token);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const priceMap = Object.fromEntries(rows.map((r) => [r.skipSize, r]));

  const handleSave = async (size: SkipSize) => {
    const raw = editing[size];
    const price = parseFloat(raw ?? '');
    if (isNaN(price) || price < 0) return;
    setSaving((s) => ({ ...s, [size]: true }));
    try {
      await setCarrierPrice(token, size, price);
      setEditing((e) => {
        const next = { ...e };
        delete next[size];
        return next;
      });
      await load();
    } finally {
      setSaving((s) => ({ ...s, [size]: false }));
    }
  };

  const handleDelete = async (size: SkipSize) => {
    setSaving((s) => ({ ...s, [size]: true }));
    try {
      await deleteCarrierPrice(token, size);
      await load();
    } finally {
      setSaving((s) => ({ ...s, [size]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Norādiet cenu (€) katram konteinera izmēram. Šī cena tiks rādīta platformas katalogā.
      </p>
      <div className="border rounded-2xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 text-left">Izmērs</th>
              <th className="px-5 py-3 text-left">Tilpums</th>
              <th className="px-5 py-3 text-left">Cena / diena</th>
              <th className="px-5 py-3 text-right">Darbības</th>
            </tr>
          </thead>
          <tbody>
            {SKIP_SIZES.map(({ value, label, volume }) => {
              const existing = priceMap[value];
              const isEditing = value in editing;
              const isSaving = !!saving[value];
              return (
                <tr
                  key={value}
                  className="border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-gray-900">{label}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{volume}</td>
                  <td className="px-5 py-3.5">
                    {isEditing ? (
                      <div className="flex items-center gap-2 max-w-35">
                        <span className="text-muted-foreground">€</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8 text-sm"
                          value={editing[value] ?? ''}
                          onChange={(e) => setEditing((ed) => ({ ...ed, [value]: e.target.value }))}
                          autoFocus
                        />
                      </div>
                    ) : existing ? (
                      <button
                        className="font-semibold text-foreground hover:underline"
                        onClick={() =>
                          setEditing((ed) => ({ ...ed, [value]: String(existing.price) }))
                        }
                      >
                        € {existing.price.toFixed(2)}
                      </button>
                    ) : (
                      <button
                        className="text-muted-foreground text-xs italic hover:text-foreground transition-colors"
                        onClick={() => setEditing((ed) => ({ ...ed, [value]: '' }))}
                      >
                        — nav norādīta
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600 hover:bg-green-50"
                            disabled={isSaving}
                            onClick={() => handleSave(value)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={isSaving}
                            onClick={() =>
                              setEditing((ed) => {
                                const next = { ...ed };
                                delete next[value];
                                return next;
                              })
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : existing ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-red-50"
                          disabled={isSaving}
                          onClick={() => handleDelete(value)}
                        >
                          {isSaving ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-primary"
                          onClick={() => setEditing((ed) => ({ ...ed, [value]: '' }))}
                        >
                          <Plus className="h-3 w-3" /> Pievienot
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Zones tab ─────────────────────────────────────────────────────────────

function ZonesTab({ token }: { token: string }) {
  const [zones, setZones] = useState<CarrierServiceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [surcharge, setSurcharge] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setZones(await getCarrierZones(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!city.trim()) return;
    setAdding(true);
    try {
      await addCarrierZone(token, {
        city: city.trim(),
        ...(postcode.trim() ? { postcode: postcode.trim() } : {}),
        ...(surcharge ? { surcharge: parseFloat(surcharge) } : {}),
      });
      setCity('');
      setPostcode('');
      setSurcharge('');
      await load();
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCarrierZone(token, id);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Pievienojiet pilsētas vai rajōnus, kurās sniedzat konteineru pakalpojumus. Pircēji var
        filtrēt pēc servisa zonas.
      </p>

      {/* Add zone form */}
      <div className="bg-white border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Pievienot jaunu zonu</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="zone-city" className="text-xs text-muted-foreground mb-1 block">
              Pilsēta *
            </Label>
            <Input
              id="zone-city"
              placeholder="Rīga"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="zone-postcode" className="text-xs text-muted-foreground mb-1 block">
              Pasta indekss
            </Label>
            <Input
              id="zone-postcode"
              placeholder="LV-1001"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="zone-surcharge" className="text-xs text-muted-foreground mb-1 block">
              Papildmaksa (€)
            </Label>
            <Input
              id="zone-surcharge"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={surcharge}
              onChange={(e) => setSurcharge(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <Button size="sm" className="gap-1.5" disabled={!city.trim() || adding} onClick={handleAdd}>
          {adding ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Pievienot zonu
        </Button>
      </div>

      {/* Zone list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : zones.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Nav pievienotu servisa zonu.
        </div>
      ) : (
        <div className="border rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 text-left">Pilsēta</th>
                <th className="px-5 py-3 text-left">Pasta indekss</th>
                <th className="px-5 py-3 text-left">Papildmaksa</th>
                <th className="px-5 py-3 text-right">Darbības</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr
                  key={z.id}
                  className="border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-gray-900">{z.city}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{z.postcode ?? '—'}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {z.surcharge != null ? `€ ${z.surcharge.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-red-50"
                      disabled={deletingId === z.id}
                      onClick={() => handleDelete(z.id)}
                    >
                      {deletingId === z.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Availability tab ──────────────────────────────────────────────────────

function AvailabilityTab({ token }: { token: string }) {
  const [blocks, setBlocks] = useState<CarrierBlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBlocks(await getCarrierBlockedDates(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBlock = async () => {
    if (!date) return;
    setAdding(true);
    try {
      await blockCarrierDate(token, date, reason.trim() || undefined);
      setDate('');
      setReason('');
      await load();
    } finally {
      setAdding(false);
    }
  };

  const handleUnblock = async (id: string) => {
    setDeletingId(id);
    try {
      await unblockCarrierDate(token, id);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const sorted = [...blocks].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Atzīmējiet datumus, kad nebūsiet pieejami. Šie datumi tiks paslēpti pircējiem, izvēloties
        konteineru piegādes laiku.
      </p>

      {/* Add block form */}
      <div className="bg-white border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Bloķēt datumu</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="block-date" className="text-xs text-muted-foreground mb-1 block">
              Datums *
            </Label>
            <Input
              id="block-date"
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="block-reason" className="text-xs text-muted-foreground mb-1 block">
              Iemesls (nav obligāts)
            </Label>
            <Input
              id="block-reason"
              placeholder="Brīvdienas, remonts..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <Button size="sm" className="gap-1.5" disabled={!date || adding} onClick={handleBlock}>
          {adding ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Bloķēt datumu
        </Button>
      </div>

      {/* Blocked dates list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Nav bloķētu datumu.</div>
      ) : (
        <div className="border rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 text-left">Datums</th>
                <th className="px-5 py-3 text-left">Iemesls</th>
                <th className="px-5 py-3 text-right">Darbības</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr
                  key={b.id}
                  className="border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {new Date(b.date).toLocaleDateString('lv-LV', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{b.reason ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-red-50"
                      disabled={deletingId === b.id}
                      onClick={() => handleUnblock(b.id)}
                    >
                      {deletingId === b.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Radius tab ───────────────────────────────────────────────────────────────────

function RadiusTab({ token }: { token: string }) {
  const [data, setData] = useState<CarrierRadiusSettings | null>(null);
  const [inputVal, setInputVal] = useState<string>('');
  const [noLimit, setNoLimit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getCarrierRadius(token).then((d) => {
      setData(d);
      if (d.serviceRadiusKm === null) {
        setNoLimit(true);
        setInputVal('');
      } else {
        setNoLimit(false);
        setInputVal(String(d.serviceRadiusKm));
      }
      setLoading(false);
    });
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const radiusKm = noLimit ? null : parseInt(inputVal, 10);
      const updated = await setCarrierRadius(token, radiusKm);
      setData(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-base">Darbības rādiuss</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Maksimālais attālums (km) no Jūsu bāzes pilsētas, kurā veicam konteineru piegādes.
            Pasūtījumi ārpus šī rādiusa netiks rādīti Jūsu katalogā.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="no-limit"
            type="checkbox"
            checked={noLimit}
            onChange={(e) => {
              setNoLimit(e.target.checked);
              if (e.target.checked) setInputVal('');
            }}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="no-limit" className="cursor-pointer">
            Nav ierobežojuma (apkalpo visu valsti)
          </Label>
        </div>

        {!noLimit && (
          <div className="space-y-1.5">
            <Label htmlFor="radius-km">Rādiuss (km)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="radius-km"
                type="number"
                min={1}
                max={500}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="p.ē. 50"
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">km</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || (!noLimit && (!inputVal || isNaN(parseInt(inputVal, 10))))}
          className="gap-2"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? 'Saglabāts' : 'Saglabāt'}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'pricing', label: 'Cenas' },
  { key: 'zones', label: 'Servisa zonas' },
  { key: 'availability', label: 'Pieejamība' },
  { key: 'radius', label: 'Darbības rādiuss' },
];

export default function CarrierSettingsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pricing');

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && !user.canSkipHire) router.push('/dashboard/transporter');
  }, [user, isLoading, router]);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nesēja iestatījumi"
        description="Pārvaldiet skip-hire cenas, servisa zonas un pieejamību"
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
              tab === key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'pricing' && <PricingTab token={token} />}
        {tab === 'zones' && <ZonesTab token={token} />}
        {tab === 'availability' && <AvailabilityTab token={token} />}
        {tab === 'radius' && <RadiusTab token={token} />}
      </div>
    </div>
  );
}
