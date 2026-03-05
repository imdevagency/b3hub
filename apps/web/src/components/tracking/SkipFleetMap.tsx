'use client';

import { useCallback, useState } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { SkipMapOrder, SkipSize } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ── Helpers ────────────────────────────────────────────────────────────────────

const SKIP_SIZE_LABEL: Record<SkipSize, string> = {
  MINI: '2m³ Mini',
  MIDI: '4m³ Midi',
  BUILDERS: '6m³ Builders',
  LARGE: '8m³ Large',
};

const WASTE_LABEL: Record<string, string> = {
  MIXED: 'Jaukti atkritumi',
  GREEN_GARDEN: 'Zaļie/dārza',
  CONCRETE_RUBBLE: 'Betona/gruveši',
  WOOD: 'Koks',
  METAL_SCRAP: 'Metāllūžņi',
  ELECTRONICS_WEEE: 'Elektronikas WEEE',
};

function daysOnSite(deliveryDate: string): number {
  const d = new Date(deliveryDate);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Marker pin appearance ──────────────────────────────────────────────────────

function SkipPin({ status, selected }: { status: string; selected: boolean }) {
  const isDelivered = status === 'DELIVERED';
  const base = isDelivered ? 'bg-emerald-500 border-emerald-700' : 'bg-amber-400 border-amber-600';
  const ring = selected ? 'ring-4 ring-white ring-offset-1' : '';

  return (
    <div
      className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border-2 shadow-lg transition-transform hover:scale-110 ${base} ${ring}`}
      title={isDelivered ? 'Izvietots' : 'Apstiprināts'}
    >
      {/* Skip bin shape */}
      <div className="flex flex-col items-center gap-[2px]">
        <div className="h-[3px] w-5 rounded-full bg-white/70" />
        <div className="h-[3px] w-5 rounded-full bg-white/70" />
        <div className="h-[3px] w-5 rounded-full bg-white/70" />
      </div>
      {/* Tail */}
      <div
        className={`absolute -bottom-[7px] left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent ${isDelivered ? 'border-t-emerald-500' : 'border-t-amber-400'}`}
      />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  skips: SkipMapOrder[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export default function SkipFleetMap({ skips, selectedId: externalSelected, onSelect }: Props) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  // Use external state if provided (controlled mode), else internal
  const selectedId = externalSelected !== undefined ? externalSelected : internalSelected;
  const handleSelect = (id: string | null) => {
    if (onSelect) onSelect(id);
    else setInternalSelected(id);
  };

  const pinned = skips.filter((s) => s.lat !== null && s.lng !== null);

  // Default center: centroid of all pinned skips, or a fallback
  const center = useCallback((): { longitude: number; latitude: number } => {
    if (pinned.length === 0) return { longitude: -0.118, latitude: 51.509 };
    const avgLng = pinned.reduce((acc, s) => acc + s.lng!, 0) / pinned.length;
    const avgLat = pinned.reduce((acc, s) => acc + s.lat!, 0) / pinned.length;
    return { longitude: avgLng, latitude: avgLat };
  }, [pinned]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-zinc-900 text-zinc-500">
        <p className="text-sm">Mapbox token nav konfigurēts.</p>
      </div>
    );
  }

  const selectedSkip = skips.find((s) => s.id === selectedId) ?? null;
  const { longitude, latitude } = center();

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{ longitude, latitude, zoom: pinned.length > 1 ? 10 : 13 }}
      style={{ width: '100%', height: '100%', borderRadius: '0.75rem' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      onClick={() => handleSelect(null)}
    >
      <NavigationControl position="top-right" />

      {pinned.map((skip) => (
        <Marker
          key={skip.id}
          longitude={skip.lng!}
          latitude={skip.lat!}
          anchor="bottom"
          onClick={(e: { originalEvent: MouseEvent }) => {
            e.originalEvent.stopPropagation();
            handleSelect(skip.id === selectedId ? null : skip.id);
          }}
        >
          <SkipPin status={skip.status} selected={selectedId === skip.id} />
        </Marker>
      ))}

      {selectedSkip && selectedSkip.lat !== null && selectedSkip.lng !== null && (
        <Popup
          longitude={selectedSkip.lng}
          latitude={selectedSkip.lat}
          anchor="bottom"
          offset={40}
          closeButton={false}
          closeOnClick={false}
          className="skip-popup"
        >
          <div className="min-w-[220px] space-y-2 rounded-lg bg-zinc-900 p-3 text-sm text-zinc-100 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-zinc-400">#{selectedSkip.orderNumber}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  selectedSkip.status === 'DELIVERED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-400/20 text-amber-400'
                }`}
              >
                {selectedSkip.status === 'DELIVERED' ? 'Izvietots' : 'Apstiprināts'}
              </span>
            </div>

            {/* Skip info */}
            <div className="space-y-1 border-t border-zinc-700 pt-2">
              <p className="text-zinc-100">
                <span className="text-zinc-400">Izmērs: </span>
                {SKIP_SIZE_LABEL[selectedSkip.skipSize]}
              </p>
              <p className="text-zinc-100">
                <span className="text-zinc-400">Atkritumi: </span>
                {WASTE_LABEL[selectedSkip.wasteCategory] ?? selectedSkip.wasteCategory}
              </p>
              <p className="text-zinc-100">
                <span className="text-zinc-400">Adrese: </span>
                {selectedSkip.location}
              </p>
              <p className="text-zinc-100">
                <span className="text-zinc-400">Piegādes datums: </span>
                {fmtDate(selectedSkip.deliveryDate)}
              </p>
              {selectedSkip.status === 'DELIVERED' && (
                <p className="text-zinc-100">
                  <span className="text-zinc-400">Uz vietas: </span>
                  <span className="font-semibold text-amber-400">
                    {daysOnSite(selectedSkip.deliveryDate)} d.
                  </span>
                </p>
              )}
            </div>

            {/* Contact */}
            {selectedSkip.contactName && (
              <div className="border-t border-zinc-700 pt-2">
                <p className="text-zinc-400">Kontakts</p>
                <p className="text-zinc-100">{selectedSkip.contactName}</p>
                {selectedSkip.contactPhone && (
                  <a
                    href={`tel:${selectedSkip.contactPhone}`}
                    className="text-blue-400 hover:underline"
                  >
                    {selectedSkip.contactPhone}
                  </a>
                )}
              </div>
            )}
          </div>
        </Popup>
      )}
    </Map>
  );
}
