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
    label: 'Invoice',
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  WEIGHING_SLIP: {
    label: 'Weighing Slip',
    icon: Weight,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  DELIVERY_PROOF: {
    label: 'Delivery Proof',
    icon: ClipboardCheck,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  WASTE_CERTIFICATE: {
    label: 'Waste Certificate',
    icon: Recycle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  DELIVERY_NOTE: {
    label: 'Delivery Note',
    icon: Truck,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  CONTRACT: {
    label: 'Contract',
    icon: ScrollText,
    color: 'text-gray-700',
    bg: 'bg-gray-100',
  },
  OTHER: {
    label: 'Document',
    icon: File,
    color: 'text-gray-500',
    bg: 'bg-gray-50',
  },
};

const STATUS_BADGE: Record<DocumentStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Draft', classes: 'bg-gray-100 text-gray-600' },
  ISSUED: { label: 'Issued', classes: 'bg-blue-100 text-blue-700' },
  SIGNED: { label: 'Signed', classes: 'bg-green-100 text-green-700' },
  ARCHIVED: { label: 'Archived', classes: 'bg-yellow-100 text-yellow-700' },
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
    <div className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-gray-300">
      {/* Icon badge */}
      <div className={`shrink-0 flex items-center justify-center h-11 w-11 rounded-lg ${meta.bg}`}>
        <Icon className={`h-5 w-5 ${meta.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-gray-900 truncate text-sm leading-snug">{doc.title}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.classes}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <p className={`text-xs font-medium mt-0.5 ${meta.color}`}>{meta.label}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(doc.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          {doc.issuedBy && <span>{doc.issuedBy}</span>}
          {formatBytes(doc.fileSize) && <span>{formatBytes(doc.fileSize)}</span>}
          {doc.isGenerated && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-500 text-[10px]">
              Auto-generated
            </span>
          )}
        </div>

        {doc.notes && <p className="mt-1.5 text-xs text-gray-400 line-clamp-1">{doc.notes}</p>}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 px-2 border-gray-200 hover:text-red-600 hover:border-red-300"
          onClick={() => onView(doc)}
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
        {doc.fileUrl && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2 border-gray-200 hover:text-red-600 hover:border-red-300"
            asChild
          >
            <a href={doc.fileUrl} download>
              <Download className="h-3 w-3 mr-1" />
              Save
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
