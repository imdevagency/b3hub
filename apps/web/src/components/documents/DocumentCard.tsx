/**
 * DocumentCard component.
 * Displays a single compliance document: type, status badge, expiry date, and download link.
 */
'use client';

import {
  FileText,
  Weight,
  ClipboardCheck,
  Recycle,
  Truck,
  ScrollText,
  File,
  Eye,
  Download,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Document, DocumentType, DocumentStatus } from '@/lib/api';

// ── Type metadata ────────────────────────────────────────────

const TYPE_META: Record<
  DocumentType,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  INVOICE: {
    label: 'Rēķins',
    icon: FileText,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  WEIGHING_SLIP: {
    label: 'Svēršanas Lapa',
    icon: Weight,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  DELIVERY_PROOF: {
    label: 'Piegādes Apstiprinājums',
    icon: ClipboardCheck,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  WASTE_CERTIFICATE: {
    label: 'Atkritumu Sertifikāts',
    icon: Recycle,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  DELIVERY_NOTE: {
    label: 'Piegādes Pavadzīme',
    icon: Truck,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  CONTRACT: {
    label: 'Līgums',
    icon: ScrollText,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  OTHER: {
    label: 'Dokuments',
    icon: File,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30',
  },
};

const STATUS_BADGE: Record<DocumentStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Melnraksts', classes: 'bg-muted text-muted-foreground' },
  ISSUED: { label: 'Izdots', classes: 'font-medium text-foreground bg-muted/50' },
  SIGNED: { label: 'Parakstīts', classes: 'font-medium text-foreground bg-muted/50' },
  ARCHIVED: { label: 'Arhivēts', classes: 'bg-muted text-muted-foreground' },
};

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────────────

interface DocumentCardProps {
  document: Document;
  onView: (doc: Document) => void;
}

export function DocumentCard({ document: doc, onView }: DocumentCardProps) {
  const meta = TYPE_META[doc.type] ?? TYPE_META.OTHER;
  const statusBadge = STATUS_BADGE[doc.status] ?? STATUS_BADGE.ISSUED;
  const Icon = meta.icon;

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 border-b border-border/40 hover:bg-muted/10 px-2 sm:px-4 -mx-2 sm:-mx-4 transition-colors relative">
      <div className="flex flex-row items-center gap-4 sm:gap-5 flex-1 min-w-0">
        {/* Icon badge */}
        <div
          className={`shrink-0 flex items-center justify-center h-12 w-12 rounded-xl ${meta.bg}`}
        >
          <Icon className={`h-5 w-5 ${meta.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <p className="font-semibold text-foreground truncate text-[15px]">{doc.title}</p>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusBadge.classes}`}
            >
              {statusBadge.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground mt-1">
            <span className="font-medium text-foreground/80">{meta.label}</span>
            <span className="text-muted-foreground/40">•</span>
            <span>
              {new Date(doc.createdAt).toLocaleDateString('lv-LV', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {doc.issuedBy && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>{doc.issuedBy}</span>
              </>
            )}
            {formatBytes(doc.fileSize) && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>{formatBytes(doc.fileSize)}</span>
              </>
            )}
            {doc.isGenerated && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-foreground/60 font-medium">Auto-ģenerēts</span>
              </>
            )}
          </div>
          {doc.notes && (
            <p className="mt-1.5 text-[13px] text-foreground/70 line-clamp-1">{doc.notes}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2 mt-2 sm:mt-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus-within:opacity-100 pl-16 sm:pl-0">
        <Button
          variant="secondary"
          size="sm"
          className="h-8 rounded-lg px-3 text-xs font-medium bg-muted/60 hover:bg-muted"
          onClick={() => onView(doc)}
        >
          Skatīt
        </Button>
        {doc.fileUrl && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 rounded-lg px-3 text-xs font-medium bg-muted/60 hover:bg-muted"
            asChild
          >
            <a href={doc.fileUrl} download>
              Lejupielādēt
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
