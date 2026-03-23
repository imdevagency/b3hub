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
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  WEIGHING_SLIP: {
    label: 'Svēršanas Lapa',
    icon: Weight,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  DELIVERY_PROOF: {
    label: 'Piegādes Apstiprinājums',
    icon: ClipboardCheck,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  WASTE_CERTIFICATE: {
    label: 'Atkritumu Sertifikāts',
    icon: Recycle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  DELIVERY_NOTE: {
    label: 'Piegādes Pavadzīme',
    icon: Truck,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  CONTRACT: {
    label: 'Līgums',
    icon: ScrollText,
    color: 'text-foreground',
    bg: 'bg-muted',
  },
  OTHER: {
    label: 'Dokuments',
    icon: File,
    color: 'text-muted-foreground',
    bg: 'bg-gray-50',
  },
};

const STATUS_BADGE: Record<DocumentStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Melnraksts', classes: 'bg-muted text-muted-foreground' },
  ISSUED: { label: 'Izdots', classes: 'bg-blue-100 text-blue-700' },
  SIGNED: { label: 'Parakstīts', classes: 'bg-green-100 text-green-700' },
  ARCHIVED: { label: 'Arhivēts', classes: 'bg-yellow-100 text-yellow-700' },
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
    <div className="group flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 rounded-[1.5rem] bg-card p-5 transition-all hover:bg-muted/30 border border-transparent hover:border-border/60 relative shadow-sm">
      {/* Icon badge */}
      <div className={`shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl ${meta.bg}`}>
        <Icon className={`h-6 w-6 ${meta.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-4 sm:pr-0">
        <div className="flex items-start sm:items-center justify-between gap-3 mb-1">
          <p className="font-medium text-foreground truncate text-base leading-snug">{doc.title}</p>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadge.classes}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <p className={`text-sm font-medium mt-0.5 mb-2 ${meta.color}`}>{meta.label}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(doc.createdAt).toLocaleDateString('lv-LV', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          {doc.issuedBy && (
            <span className="flex items-center before:content-[''] before:block before:w-1 before:h-1 before:rounded-full before:bg-muted-foreground/30 before:mr-4">
              {doc.issuedBy}
            </span>
          )}
          {formatBytes(doc.fileSize) && (
            <span className="flex items-center before:content-[''] before:block before:w-1 before:h-1 before:rounded-full before:bg-muted-foreground/30 before:mr-4">
              {formatBytes(doc.fileSize)}
            </span>
          )}
          {doc.isGenerated && (
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-foreground text-[11px] font-medium border border-border/50">
              Automātiski ģenerēts
            </span>
          )}
        </div>

        {doc.notes && <p className="mt-2.5 text-sm text-foreground/70 line-clamp-1">{doc.notes}</p>}
      </div>

      {/* Actions */}
      <div className="absolute top-5 right-5 sm:relative sm:top-auto sm:right-auto shrink-0 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus-within:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 rounded-xl border-border/60 hover:bg-background shadow-xs font-medium"
          onClick={() => onView(doc)}
        >
          <Eye className="h-4 w-4 mr-2" />
          Skatīt
        </Button>
        {doc.fileUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-xl border-border/60 hover:bg-background shadow-xs font-medium"
            asChild
          >
            <a href={doc.fileUrl} download>
              <Download className="h-4 w-4 mr-2" />
              Saglabāt
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
