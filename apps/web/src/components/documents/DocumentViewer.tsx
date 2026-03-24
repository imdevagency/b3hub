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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-5xl h-[85vh] bg-background rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 border-b border-border/40 gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-muted/50 text-foreground">
              {resolveIcon(document.mimeType)}
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-xl tracking-tight">
                {document.title}
              </h2>
              <div className="flex items-center text-[13px] text-muted-foreground mt-1 gap-1">
                {document.issuedBy && (
                  <span className="font-medium text-foreground">{document.issuedBy}</span>
                )}
                {document.issuedBy && <span className="mx-1.5 opacity-50">•</span>}
                <span>
                  {new Date(document.createdAt).toLocaleDateString('lv-LV', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                {formatBytes(document.fileSize) && (
                  <>
                    <span className="mx-1.5 opacity-50">•</span>
                    <span>{formatBytes(document.fileSize)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasFile && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-xl border-border bg-background hover:bg-muted font-medium h-9"
                >
                  <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Atvērt jaunā logā
                  </a>
                </Button>
                <Button variant="default" size="sm" asChild className="rounded-xl font-medium h-9">
                  <a href={document.fileUrl} download>
                    <Download className="h-4 w-4 mr-2" />
                    Lejupielādēt
                  </a>
                </Button>
              </>
            )}
            <button
              onClick={onClose}
              className="ml-2 rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              aria-label="Aizvērt"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Body: document preview ── */}
        <div className="flex-1 overflow-auto bg-muted/10 relative">
          {!hasFile && (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-3 text-muted-foreground/60">
              {resolveIcon(document.mimeType)}
              <p className="text-base font-medium text-foreground">Datne vēl nav pievienota</p>
              <p className="text-sm max-w-sm text-center">
                Šis dokumenta ieraksts pastāv, bet PDF vai cits fails vēl nav augšupielādēts.
              </p>
            </div>
          )}

          {hasFile && isPdf && (
            <iframe
              src={`${document.fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title={document.title}
              className="w-full h-full border-0 absolute inset-0 bg-white"
            />
          )}

          {hasFile && isImage && (
            <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#F9F9F9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={document.fileUrl}
                alt={document.title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-sm border border-border/50"
              />
            </div>
          )}

          {hasFile && !isPdf && !isImage && (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-muted-foreground">
              {resolveIcon(document.mimeType)}
              <p className="text-base font-medium text-foreground">
                Priekšskatījums nav pieejams šim formātam
              </p>
              <Button variant="outline" className="rounded-xl mt-2" asChild>
                <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">
                  Lejupielādēt datni
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* ── Footer: metadata ── */}
        {document.notes && (
          <div className="px-6 py-4 bg-background border-t border-border/40">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Piezīmes: </span>
              {document.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
