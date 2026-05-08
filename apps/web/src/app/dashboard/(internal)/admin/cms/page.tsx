'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  FileText,
  Globe,
  Info,
  Layers,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  type CmsAnnouncement,
  type CmsArticle,
  type CmsArticleType,
  type CmsStatus,
  type AnnouncementSeverity,
  type AnnouncementTarget,
  createAnnouncement,
  createArticle,
  deleteAnnouncement,
  deleteArticle,
  getArticle,
  listAnnouncements,
  listArticles,
  updateAnnouncement,
  updateArticle,
} from '@/lib/api/cms';

// ─── Constants ───────────────────────────────────────────────────────────────

const ARTICLE_TYPE_LABELS: Record<CmsArticleType, string> = {
  HELP: 'Palīdzība',
  FAQ: 'BUJ',
  BLOG: 'Blog',
  POLICY: 'Politika',
  PAGE: 'Lapa',
  LANDING: 'Sākumlapa bloks',
};

const STATUS_LABELS: Record<CmsStatus, string> = {
  DRAFT: 'Melnraksts',
  PUBLISHED: 'Publicēts',
  ARCHIVED: 'Arhivēts',
};

const STATUS_COLORS: Record<CmsStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

const SEVERITY_LABELS: Record<AnnouncementSeverity, string> = {
  INFO: 'Info',
  WARNING: 'Brīdinājums',
  CRITICAL: 'Kritisks',
};

const SEVERITY_COLORS: Record<AnnouncementSeverity, string> = {
  INFO: 'bg-blue-100 text-blue-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const SEVERITY_ICONS: Record<AnnouncementSeverity, React.ElementType> = {
  INFO: Info,
  WARNING: AlertTriangle,
  CRITICAL: Zap,
};

const ARTICLE_TYPE_ICONS: Record<CmsArticleType, React.ElementType> = {
  HELP: Info,
  FAQ: BookOpen,
  BLOG: FileText,
  POLICY: Archive,
  PAGE: Layers,
  LANDING: Globe,
};

const LOCALE_LABELS: Record<string, string> = {
  lv: 'LV',
  en: 'EN',
  ru: 'RU',
};

const LOCALE_COLORS: Record<string, string> = {
  lv: 'bg-red-100 text-red-700',
  en: 'bg-blue-100 text-blue-700',
  ru: 'bg-purple-100 text-purple-700',
};

const TARGET_LABELS: Record<AnnouncementTarget, string> = {
  ALL: 'Visi',
  BUYER: 'Pircēji',
  SELLER: 'Pārdevēji',
  DRIVER: 'Šoferi',
  ADMIN: 'Admini',
};

// ─── Article editor sheet ─────────────────────────────────────────────────────

interface ArticleSheetProps {
  articleId: string | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function ArticleSheet({ articleId, token, onClose, onSaved }: ArticleSheetProps) {
  const isNew = articleId === 'new';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    body: '',
    excerpt: '',
    type: 'HELP' as CmsArticleType,
    status: 'DRAFT' as CmsStatus,
    locale: 'lv',
    translationKey: '',
    pageKey: '',
  });

  useEffect(() => {
    if (!articleId || isNew) {
      setForm({
        title: '',
        slug: '',
        body: '',
        excerpt: '',
        type: 'HELP',
        status: 'DRAFT',
        locale: 'lv',
        translationKey: '',
        pageKey: '',
      });
      return;
    }
    setLoading(true);
    getArticle(token, articleId)
      .then((a) =>
        setForm({
          title: a.title,
          slug: a.slug,
          body: a.body ?? '',
          excerpt: a.excerpt ?? '',
          type: a.type,
          status: a.status,
          locale: a.locale,
          translationKey: a.translationKey ?? '',
          pageKey: a.pageKey ?? '',
        }),
      )
      .finally(() => setLoading(false));
  }, [articleId, token, isNew]);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function autoSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  async function handleSave() {
    if (!form.title.trim() || !form.slug.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await createArticle(token, {
          title: form.title,
          slug: form.slug,
          body: form.body,
          excerpt: form.excerpt || undefined,
          type: form.type,
          status: form.status,
          locale: form.locale,
          translationKey: form.translationKey || undefined,
          pageKey: form.pageKey || undefined,
        });
      } else {
        await updateArticle(token, articleId!, {
          title: form.title,
          slug: form.slug,
          body: form.body,
          excerpt: form.excerpt || undefined,
          type: form.type,
          status: form.status,
          locale: form.locale,
          translationKey: form.translationKey || undefined,
          pageKey: form.pageKey || undefined,
        });
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!articleId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{isNew ? 'Jauns raksts' : 'Rediģēt rakstu'}</SheetTitle>
        </SheetHeader>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Virsraksts *</Label>
              <Input
                value={form.title}
                onChange={(e) => {
                  set('title', e.target.value);
                  if (isNew) set('slug', autoSlug(e.target.value));
                }}
                placeholder="Kā pasūtīt materiālus?"
              />
            </div>
            <div className="space-y-1">
              <Label>Slug *</Label>
              <Input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="ka-pasutit-materialus"
                className="font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Tips</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ARTICLE_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Statuss</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valoda</Label>
                <Select value={form.locale} onValueChange={(v) => set('locale', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lv">Latviešu</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ru">Русский</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Translation Key</Label>
                <Input
                  value={form.translationKey}
                  onChange={(e) => set('translationKey', e.target.value)}
                  placeholder="par-mums  (grupē tulkojumus)"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label>Page Key</Label>
                <Input
                  value={form.pageKey}
                  onChange={(e) => set('pageKey', e.target.value)}
                  placeholder="home | about | services | blog…"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Īss apraksts</Label>
              <Input
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                placeholder="Īss apraksts meklēšanai un sarakstiem..."
              />
            </div>
            <div className="space-y-1">
              <Label>Saturs (Markdown) *</Label>
              <Textarea
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                rows={16}
                className="font-mono text-sm resize-none"
                placeholder="# Virsraksts&#10;&#10;Raksta saturs..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Atcelt
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.slug.trim() || !form.body.trim()}
              >
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Saglabāt
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── New announcement dialog ──────────────────────────────────────────────────

interface AnnouncementDialogProps {
  open: boolean;
  editing: CmsAnnouncement | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function AnnouncementDialog({ open, editing, token, onClose, onSaved }: AnnouncementDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    severity: 'INFO' as AnnouncementSeverity,
    target: 'ALL' as AnnouncementTarget,
    visibleUntil: '',
  });

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        body: editing.body,
        severity: editing.severity,
        target: editing.target,
        visibleUntil: editing.visibleUntil
          ? new Date(editing.visibleUntil).toISOString().slice(0, 16)
          : '',
      });
    } else {
      setForm({ title: '', body: '', severity: 'INFO', target: 'ALL', visibleUntil: '' });
    }
  }, [editing]);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const data = {
        title: form.title,
        body: form.body,
        severity: form.severity,
        target: form.target,
        visibleUntil: form.visibleUntil || undefined,
      };
      if (editing) {
        await updateAnnouncement(token, editing.id, data);
      } else {
        await createAnnouncement(token, data);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Rediģēt paziņojumu' : 'Jauns paziņojums'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Virsraksts *</Label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Sistēmas apkope šonakt 02:00–04:00"
            />
          </div>
          <div className="space-y-1">
            <Label>Ziņojums *</Label>
            <Textarea
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              rows={3}
              placeholder="Plānota sistēmas apkope..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Svarīgums</Label>
              <Select value={form.severity} onValueChange={(v) => set('severity', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mērķauditorija</Label>
              <Select value={form.target} onValueChange={(v) => set('target', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TARGET_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Rādīt līdz (neobligāti)</Label>
            <Input
              type="datetime-local"
              value={form.visibleUntil}
              onChange={(e) => set('visibleUntil', e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Atcelt
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.body.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Saglabāt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Articles tab ─────────────────────────────────────────────────────────────

function ArticlesTab({
  token,
  refresh,
  onEdit,
}: {
  token: string;
  refresh: number;
  onEdit: (id: string) => void;
}) {
  const [articles, setArticles] = useState<CmsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CmsArticleType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<CmsStatus | 'ALL'>('ALL');
  const [localeFilter, setLocaleFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    listArticles(token, {
      type: typeFilter !== 'ALL' ? typeFilter : undefined,
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      locale: localeFilter !== 'ALL' ? localeFilter : undefined,
    })
      .then(setArticles)
      .catch(() => setError('Neizdevās ielādēt rakstus.'))
      .finally(() => setLoading(false));
  }, [token, typeFilter, statusFilter, localeFilter, refresh]);

  async function handleTogglePublish(a: CmsArticle) {
    const next: CmsStatus = a.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    await updateArticle(token, a.id, { status: next });
    setArticles((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
  }

  async function handleDelete(id: string) {
    if (!confirm('Dzēst šo rakstu?')) return;
    await deleteArticle(token, id);
    setArticles((a) => a.filter((x) => x.id !== id));
  }

  const filtered = search.trim()
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.slug.toLowerCase().includes(search.toLowerCase()) ||
          (a.pageKey ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (a.translationKey ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : articles;

  // Stats
  const total = articles.length;
  const published = articles.filter((a) => a.status === 'PUBLISHED').length;
  const drafts = articles.filter((a) => a.status === 'DRAFT').length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-2">
          <CardContent className="p-0 px-3">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">Kopā</div>
          </CardContent>
        </Card>
        <Card className="text-center py-2">
          <CardContent className="p-0 px-3">
            <div className="text-2xl font-bold text-green-600">{published}</div>
            <div className="text-xs text-muted-foreground">Publicēti</div>
          </CardContent>
        </Card>
        <Card className="text-center py-2">
          <CardContent className="p-0 px-3">
            <div className="text-2xl font-bold text-yellow-600">{drafts}</div>
            <div className="text-xs text-muted-foreground">Melnraksti</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-9 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Meklēt virsrakstu, slug, pageKey…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as CmsArticleType | 'ALL')}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tips" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visi tipi</SelectItem>
            {Object.entries(ARTICLE_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CmsStatus | 'ALL')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Statuss" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visi statusi</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={localeFilter} onValueChange={setLocaleFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Valoda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visas</SelectItem>
            <SelectItem value="lv">Latviešu</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ru">Русский</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-32 gap-2">
            <FileText className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {articles.length === 0
                ? 'Nav rakstu. Pievienojiet pirmo.'
                : 'Nav atbilstošu rezultātu.'}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((a) => {
                const TypeIcon = ARTICLE_TYPE_ICONS[a.type];
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-medium text-sm truncate">{a.title}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${LOCALE_COLORS[a.locale] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {LOCALE_LABELS[a.locale] ?? a.locale.toUpperCase()}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status]}`}
                        >
                          {STATUS_LABELS[a.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{ARTICLE_TYPE_LABELS[a.type]}</span>
                        <span className="font-mono">/{a.slug}</span>
                        {a.pageKey && (
                          <span className="flex items-center gap-0.5">
                            <Layers className="h-3 w-3" />
                            {a.pageKey}
                          </span>
                        )}
                        {a.translationKey && (
                          <span className="flex items-center gap-0.5">
                            <Tag className="h-3 w-3" />
                            {a.translationKey}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleTogglePublish(a)}
                        title={a.status === 'PUBLISHED' ? 'Arhivēt' : 'Publicēt'}
                        className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        {a.status === 'PUBLISHED' ? (
                          <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        )}
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => onEdit(a.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Announcements tab ────────────────────────────────────────────────────────

function AnnouncementsTab({
  token,
  refresh,
  onEdit,
}: {
  token: string;
  refresh: number;
  onEdit: (a: CmsAnnouncement) => void;
}) {
  const [items, setItems] = useState<CmsAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listAnnouncements(token)
      .then(setItems)
      .catch(() => setError('Neizdevās ielādēt paziņojumus.'))
      .finally(() => setLoading(false));
  }, [token, refresh]);

  async function handleToggleActive(item: CmsAnnouncement) {
    await updateAnnouncement(token, item.id, { active: !item.active });
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x)));
  }

  async function handleDelete(id: string) {
    if (!confirm('Dzēst šo paziņojumu?')) return;
    await deleteAnnouncement(token, id);
    setItems((a) => a.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-32 gap-2">
            <Megaphone className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nav paziņojumu.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const SeverityIcon = SEVERITY_ICONS[item.severity];
            return (
              <Card key={item.id} className={item.active ? '' : 'opacity-50'}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <SeverityIcon
                      className={`h-4 w-4 mt-0.5 shrink-0 ${item.severity === 'CRITICAL' ? 'text-red-500' : item.severity === 'WARNING' ? 'text-yellow-500' : 'text-blue-500'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{item.title}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[item.severity]}`}
                        >
                          {SEVERITY_LABELS[item.severity]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {TARGET_LABELS[item.target]}
                        </span>
                        {!item.active && (
                          <span className="text-xs text-muted-foreground">(neaktīvs)</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.body}</p>
                      {item.visibleUntil && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Līdz:{' '}
                          {new Date(item.visibleUntil).toLocaleString('lv-LV', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(item)}
                        title={item.active ? 'Deaktivizēt' : 'Aktivizēt'}
                      >
                        {item.active ? (
                          <X className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CmsPage() {
  const { token } = useAuth();
  const safeToken = token ?? '';

  const [tab, setTab] = useState('articles');
  const [refresh, setRefresh] = useState(0);
  const [articleSheetId, setArticleSheetId] = useState<string | null>(null);
  const [announcementDialog, setAnnouncementDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<CmsAnnouncement | null>(null);

  function doRefresh() {
    setRefresh((r) => r + 1);
  }

  function openNewAnnouncement() {
    setEditingAnnouncement(null);
    setAnnouncementDialog(true);
  }

  function openEditAnnouncement(a: CmsAnnouncement) {
    setEditingAnnouncement(a);
    setAnnouncementDialog(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CMS"
        description="Vietnes saturs, raksti un sistēmas paziņojumi — LV / EN / RU"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={doRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {tab === 'articles' ? (
              <Button onClick={() => setArticleSheetId('new')}>
                <Plus className="h-4 w-4 mr-1.5" />
                Jauns raksts
              </Button>
            ) : (
              <Button onClick={openNewAnnouncement}>
                <Plus className="h-4 w-4 mr-1.5" />
                Jauns paziņojums
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="articles" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Raksti
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            Paziņojumi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="mt-4">
          <ArticlesTab token={safeToken} refresh={refresh} onEdit={setArticleSheetId} />
        </TabsContent>

        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsTab token={safeToken} refresh={refresh} onEdit={openEditAnnouncement} />
        </TabsContent>
      </Tabs>

      <ArticleSheet
        articleId={articleSheetId}
        token={safeToken}
        onClose={() => setArticleSheetId(null)}
        onSaved={doRefresh}
      />

      <AnnouncementDialog
        open={announcementDialog}
        editing={editingAnnouncement}
        token={safeToken}
        onClose={() => setAnnouncementDialog(false)}
        onSaved={doRefresh}
      />
    </div>
  );
}
