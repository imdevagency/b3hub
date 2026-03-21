/**
 * DocumentViewer component.
 * Modal/drawer that renders a document preview with metadata and admin action buttons.
 */
'use client';

import { useEffect, useRef } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Document } from '@/lib/api';

interface DocumentViewerProps {
  document: Document | null;
  onClose: () => void;
}

function resolveIcon(mimeType?: string) {
  if (!mimeType) return <File className="h-10 w-10 text-muted-foreground/80" />;
  if (mimeType === 'application/pdf') return <FileText className="h-10 w-10 text-red-500" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-10 w-10 text-blue-500" />;
  return <File className="h-10 w-10 text-muted-foreground/80" />;
}

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!document) return null;

  const isImage = document.mimeType?.startsWith('image/');
  const isPdf = document.mimeType === 'application/pdf';
  const hasFile = !!document.fileUrl;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-background rounded-[2rem] shadow-2xl overflow-hidden border border-border/40">
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border/40 bg-muted/40">
          <div className="flex items-center gap-3">
            {resolveIcon(document.mimeType)}
            <div>
              <h2 className="font-semibold text-foreground text-lg leading-tight">
                {document.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {document.issuedBy && <span>{document.issuedBy} · </span>}
                {new Date(document.createdAt).toLocaleDateString('lv-LV', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {formatBytes(document.fileSize) && <span> · {formatBytes(document.fileSize)}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
            {hasFile && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="text-muted-foreground border-gray-200 hover:text-red-600 hover:border-red-300"
                >
                  <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Atvērt
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="text-muted-foreground border-gray-200 hover:text-red-600 hover:border-red-300"
                >
                  <a href={document.fileUrl} download>
                    <Download className="h-4 w-4 mr-1.5" />
                    Lejūpielādēt
                  </a>
                </Button>
              </>
            )}
            <button
              onClick={onClose}
              className="ml-2 rounded-lg p-1.5 text-muted-foreground/80 hover:text-foreground hover:bg-gray-200 transition-colors"
              aria-label="Close viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Body: document preview ── */}
        <div className="flex-1 overflow-auto bg-muted/20 min-h-100">
          {!hasFile && (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-3 text-muted-foreground/80">
              {resolveIcon(document.mimeType)}
              <p className="text-sm font-medium">Datne vēl nav pievienota</p>
              <p className="text-xs text-muted-foreground/80 max-w-xs text-center">
                Šis dokumenta ieraksts pastāv, bet PDF vai fails vēl nav augšupielādēts.
              </p>
            </div>
          )}

          {hasFile && isPdf && (
            <iframe
              src={`${document.fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title={document.title}
              className="w-full h-full min-h-125 border-0"
            />
          )}

          {hasFile && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.fileUrl}
              alt={document.title}
              className="max-w-full max-h-full object-contain mx-auto block p-4"
            />
          )}

          {hasFile && !isPdf && !isImage && (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-muted-foreground">
              {resolveIcon(document.mimeType)}
              <p className="text-sm font-medium">Priekšskatījums nav pieejams</p>
              <Button variant="outline" size="sm" asChild>
                <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Atvērt datni
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* ── Footer: metadata ── */}
        {document.notes && (
          <div className="px-6 py-4 border-t border-border/40 bg-muted/40">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Piezīmes: </span>
              {document.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
