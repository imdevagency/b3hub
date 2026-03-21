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
    <div className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-3xl border border-transparent bg-muted/40 p-4 transition-all hover:bg-muted/60 relative">
      {/* Icon badge */}
      <div className={`shrink-0 flex items-center justify-center h-11 w-11 rounded-lg ${meta.bg}`}>
        <Icon className={`h-5 w-5 ${meta.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-4 sm:pr-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-foreground truncate text-sm leading-snug">{doc.title}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.classes}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <p className={`text-xs font-medium mt-0.5 ${meta.color}`}>{meta.label}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground/80">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(doc.createdAt).toLocaleDateString('lv-LV', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          {doc.issuedBy && <span>{doc.issuedBy}</span>}
          {formatBytes(doc.fileSize) && <span>{formatBytes(doc.fileSize)}</span>}
          {doc.isGenerated && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground text-[10px]">
              Automātiski ģenerēts
            </span>
          )}
        </div>

        {doc.notes && <p className="mt-1.5 text-xs text-muted-foreground/80 line-clamp-1">{doc.notes}</p>}
      </div>

      {/* Actions */}
      <div className="absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto shrink-0 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 px-2 border-border/40 hover:text-red-600 hover:border-red-300"
          onClick={() => onView(doc)}
        >
          <Eye className="h-3 w-3 mr-1" />
          Skatīt
        </Button>
        {doc.fileUrl && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2 border-border/40 hover:text-red-600 hover:border-red-300"
            asChild
          >
            <a href={doc.fileUrl} download>
              <Download className="h-3 w-3 mr-1" />
              Saglabāt
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
