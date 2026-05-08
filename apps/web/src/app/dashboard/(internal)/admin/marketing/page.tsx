/**
 * Admin Marketing Module — /dashboard/admin/marketing
 *
 * Four tabs:
 *  1. Ieraksti   — Create & manage platform announcements / posts (localStorage)
 *  2. Baneri     — Promotional banners for the buyer app (localStorage)
 *  3. Auditorija — Audience segments derived from live admin stats
 *  4. Analītika  — Platform content & engagement metrics
 *
 * Posts & banners are stored client-side (localStorage) until a backend
 * marketing model is implemented.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Image,
  Loader2,
  Megaphone,
  Package,
  PenSquare,
  Plus,
  RefreshCw,
  Send,
  ShoppingCart,
  Store,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  X,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  getAdminStats,
  adminGetMaterials,
  type AdminStats,
  type AdminMaterial,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// ─── Types ─────────────────────────────────────────────────────────────────────

type PostType = 'INFO' | 'PROMO' | 'ALERT' | 'NEWS';
type PostStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
type PostAudience = 'ALL' | 'BUYERS' | 'SELLERS' | 'CARRIERS';
type BannerPosition = 'HOME' | 'CATALOG' | 'ORDERS';

interface MarketingPost {
  id: string;
  title: string;
  body: string;
  type: PostType;
  audience: PostAudience;
  status: PostStatus;
  publishAt?: string;
  expiresAt?: string;
  createdAt: string;
}

interface MarketingBanner {
  id: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  imageUrl?: string;
  position: BannerPosition;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const POST_TYPE_META: Record<PostType, { label: string; className: string }> = {
  INFO: { label: 'Informācija', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  PROMO: { label: 'Akcija', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  ALERT: { label: 'Brīdinājums', className: 'bg-red-50 text-red-700 border-red-200' },
  NEWS: { label: 'Jaunumi', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const POST_STATUS_META: Record<PostStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Melnraksts', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  PUBLISHED: { label: 'Publicēts', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SCHEDULED: { label: 'Plānots', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  ARCHIVED: { label: 'Arhivēts', className: 'bg-gray-50 text-gray-400 border-gray-200' },
};

const AUDIENCE_META: Record<PostAudience, { label: string; icon: React.ElementType }> = {
  ALL: { label: 'Visi', icon: Users },
  BUYERS: { label: 'Pircēji', icon: ShoppingCart },
  SELLERS: { label: 'Piegādātāji', icon: Store },
  CARRIERS: { label: 'Pārvadātāji', icon: Truck },
};

const BANNER_POSITION_META: Record<BannerPosition, string> = {
  HOME: 'Sākumlapa',
  CATALOG: 'Katalogs',
  ORDERS: 'Pasūtījumi',
};

const LS_POSTS_KEY = 'b3-marketing-posts';
const LS_BANNERS_KEY = 'b3-marketing-banners';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Post Form Dialog ───────────────────────────────────────────────────────────

interface PostFormState {
  title: string;
  body: string;
  type: PostType;
  audience: PostAudience;
  status: PostStatus;
  publishAt: string;
  expiresAt: string;
}

const emptyPost = (): PostFormState => ({
  title: '',
  body: '',
  type: 'INFO',
  audience: 'ALL',
  status: 'DRAFT',
  publishAt: '',
  expiresAt: '',
});

function PostDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial?: MarketingPost | null;
  onSave: (data: PostFormState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PostFormState>(emptyPost);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              title: initial.title,
              body: initial.body,
              type: initial.type,
              audience: initial.audience,
              status: initial.status,
              publishAt: initial.publishAt ?? '',
              expiresAt: initial.expiresAt ?? '',
            }
          : emptyPost(),
      );
    }
  }, [open, initial]);

  const set = (k: keyof PostFormState, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const valid = form.title.trim().length > 0 && form.body.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Rediģēt ierakstu' : 'Jauns ieraksts'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <Label htmlFor="p-title">Virsraksts *</Label>
            <Input
              id="p-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ieraksta virsraksts"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="p-body">Saturs *</Label>
            <Textarea
              id="p-body"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              placeholder="Ieraksta teksts..."
              rows={4}
              className="mt-1 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tips</Label>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value as PostType)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(POST_TYPE_META) as PostType[]).map((t) => (
                  <option key={t} value={t}>
                    {POST_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Auditorija</Label>
              <select
                value={form.audience}
                onChange={(e) => set('audience', e.target.value as PostAudience)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(AUDIENCE_META) as PostAudience[]).map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_META[a].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Statuss</Label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as PostStatus)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(POST_STATUS_META) as PostStatus[]).map((s) => (
                <option key={s} value={s}>
                  {POST_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-publishAt">Publicēšanas datums</Label>
              <Input
                id="p-publishAt"
                type="date"
                value={form.publishAt}
                onChange={(e) => set('publishAt', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="p-expiresAt">Derīguma termiņš</Label>
              <Input
                id="p-expiresAt"
                type="date"
                value={form.expiresAt}
                onChange={(e) => set('expiresAt', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Atcelt
          </Button>
          <Button onClick={() => onSave(form)} disabled={!valid}>
            {initial ? 'Saglabāt' : 'Izveidot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Banner Form Dialog ─────────────────────────────────────────────────────────

interface BannerFormState {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  imageUrl: string;
  position: BannerPosition;
  active: boolean;
  sortOrder: string;
}

const emptyBanner = (): BannerFormState => ({
  title: '',
  subtitle: '',
  ctaText: '',
  ctaHref: '',
  imageUrl: '',
  position: 'HOME',
  active: true,
  sortOrder: '0',
});

function BannerDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial?: MarketingBanner | null;
  onSave: (data: BannerFormState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BannerFormState>(emptyBanner);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              title: initial.title,
              subtitle: initial.subtitle ?? '',
              ctaText: initial.ctaText ?? '',
              ctaHref: initial.ctaHref ?? '',
              imageUrl: initial.imageUrl ?? '',
              position: initial.position,
              active: initial.active,
              sortOrder: String(initial.sortOrder),
            }
          : emptyBanner(),
      );
    }
  }, [open, initial]);

  const set = (k: keyof BannerFormState, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));
  const valid = form.title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Rediģēt baneri' : 'Jauns baneris'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <Label htmlFor="b-title">Virsraksts *</Label>
            <Input
              id="b-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Baneŗa virsraksts"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="b-subtitle">Apraksts</Label>
            <Input
              id="b-subtitle"
              value={form.subtitle}
              onChange={(e) => set('subtitle', e.target.value)}
              placeholder="Īss papildu teksts"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="b-ctaText">CTA teksts</Label>
              <Input
                id="b-ctaText"
                value={form.ctaText}
                onChange={(e) => set('ctaText', e.target.value)}
                placeholder="Skatīt vairāk"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="b-ctaHref">CTA saite</Label>
              <Input
                id="b-ctaHref"
                value={form.ctaHref}
                onChange={(e) => set('ctaHref', e.target.value)}
                placeholder="/catalog"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="b-imageUrl">Attēla URL</Label>
            <Input
              id="b-imageUrl"
              value={form.imageUrl}
              onChange={(e) => set('imageUrl', e.target.value)}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pozīcija</Label>
              <select
                value={form.position}
                onChange={(e) => set('position', e.target.value as BannerPosition)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(BANNER_POSITION_META) as BannerPosition[]).map((p) => (
                  <option key={p} value={p}>
                    {BANNER_POSITION_META[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="b-sortOrder">Kārtošanas Nr.</Label>
              <Input
                id="b-sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm font-medium">Aktīvs</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Atcelt
          </Button>
          <Button onClick={() => onSave(form)} disabled={!valid}>
            {initial ? 'Saglabāt' : 'Izveidot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminMarketingPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [banners, setBanners] = useState<MarketingBanner[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [postDialog, setPostDialog] = useState<{ open: boolean; editing: MarketingPost | null }>({
    open: false,
    editing: null,
  });
  const [bannerDialog, setBannerDialog] = useState<{
    open: boolean;
    editing: MarketingBanner | null;
  }>({
    open: false,
    editing: null,
  });
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deleteBannerId, setDeleteBannerId] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  // Load live data
  const loadStats = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const [statsRes, matsRes] = await Promise.allSettled([
        getAdminStats(token),
        adminGetMaterials(token),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (matsRes.status === 'fulfilled') setMaterials(matsRes.value);
    } finally {
      setStatsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) loadStats();
  }, [isLoading, token, loadStats]);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_POSTS_KEY);
      if (raw) setPosts(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(LS_BANNERS_KEY);
      if (raw) setBanners(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Persist
  function savePosts(list: MarketingPost[]) {
    setPosts(list);
    localStorage.setItem(LS_POSTS_KEY, JSON.stringify(list));
  }

  function saveBanners(list: MarketingBanner[]) {
    setBanners(list);
    localStorage.setItem(LS_BANNERS_KEY, JSON.stringify(list));
  }

  // Post CRUD
  function handleSavePost(data: PostFormState) {
    if (postDialog.editing) {
      savePosts(
        posts.map((p) =>
          p.id === postDialog.editing!.id
            ? {
                ...postDialog.editing!,
                ...data,
                publishAt: data.publishAt || undefined,
                expiresAt: data.expiresAt || undefined,
              }
            : p,
        ),
      );
    } else {
      savePosts([
        ...posts,
        {
          id: uid(),
          ...data,
          publishAt: data.publishAt || undefined,
          expiresAt: data.expiresAt || undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setPostDialog({ open: false, editing: null });
  }

  function handleDeletePost(id: string) {
    savePosts(posts.filter((p) => p.id !== id));
    setDeletePostId(null);
  }

  function setPostStatus(id: string, status: PostStatus) {
    savePosts(posts.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  // Banner CRUD
  function handleSaveBanner(data: BannerFormState) {
    if (bannerDialog.editing) {
      saveBanners(
        banners.map((b) =>
          b.id === bannerDialog.editing!.id
            ? {
                ...bannerDialog.editing!,
                ...data,
                sortOrder: Number(data.sortOrder) || 0,
                subtitle: data.subtitle || undefined,
                ctaText: data.ctaText || undefined,
                ctaHref: data.ctaHref || undefined,
                imageUrl: data.imageUrl || undefined,
              }
            : b,
        ),
      );
    } else {
      saveBanners([
        ...banners,
        {
          id: uid(),
          ...data,
          sortOrder: Number(data.sortOrder) || 0,
          subtitle: data.subtitle || undefined,
          ctaText: data.ctaText || undefined,
          ctaHref: data.ctaHref || undefined,
          imageUrl: data.imageUrl || undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setBannerDialog({ open: false, editing: null });
  }

  function handleDeleteBanner(id: string) {
    saveBanners(banners.filter((b) => b.id !== id));
    setDeleteBannerId(null);
  }

  function toggleBannerActive(id: string) {
    saveBanners(banners.map((b) => (b.id === id ? { ...b, active: !b.active } : b)));
  }

  // Derived stats
  const publishedCount = posts.filter((p) => p.status === 'PUBLISHED').length;
  const activeBanners = banners.filter((b) => b.active).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Mārketings"
        description="In-app paziņojumi, baneri un auditorijas pārvaldība"
        action={
          <Button size="sm" variant="outline" onClick={() => loadStats()} disabled={statsLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${statsLoading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Publicēti ieraksti',
            value: publishedCount,
            icon: Send,
            color: 'text-emerald-600',
          },
          {
            label: 'Aktīvie baneri',
            value: activeBanners,
            icon: Image,
            color: 'text-sky-600',
          },
          {
            label: 'Kopā ieraksti',
            value: posts.length,
            icon: PenSquare,
            color: 'text-foreground',
          },
          {
            label: 'Kopā baneri',
            value: banners.length,
            icon: Megaphone,
            color: 'text-foreground',
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="posts">
            <PenSquare className="h-3.5 w-3.5 mr-1.5" />
            Ieraksti
          </TabsTrigger>
          <TabsTrigger value="banners">
            <Image className="h-3.5 w-3.5 mr-1.5" />
            Baneri
          </TabsTrigger>
          <TabsTrigger value="audience">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Auditorija
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Analītika
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Posts ── */}
        <TabsContent value="posts" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Platformas paziņojumi un ieraksti
            </h2>
            <Button size="sm" onClick={() => setPostDialog({ open: true, editing: null })}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauns ieraksts
            </Button>
          </div>

          {posts.length === 0 ? (
            <EmptyState
              icon={PenSquare}
              title="Nav ierakstu"
              description="Izveidojiet pirmo paziņojumu, akciju vai jaunumu lietotājiem."
              action={
                <Button size="sm" onClick={() => setPostDialog({ open: true, editing: null })}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Pievienot ierakstu
                </Button>
              }
            />
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-background">
              {posts.map((post, idx) => (
                <div
                  key={post.id}
                  className={`flex items-start gap-4 p-4 ${idx < posts.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 border ${POST_TYPE_META[post.type].className}`}
                      >
                        {POST_TYPE_META[post.type].label}
                      </span>
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 border ${POST_STATUS_META[post.status].className}`}
                      >
                        {POST_STATUS_META[post.status].label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {AUDIENCE_META[post.audience].label}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-foreground leading-tight">
                      {post.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{fmt(post.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {post.status === 'DRAFT' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => setPostStatus(post.id, 'PUBLISHED')}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Publicēt
                      </Button>
                    )}
                    {post.status === 'PUBLISHED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2.5"
                        onClick={() => setPostStatus(post.id, 'ARCHIVED')}
                      >
                        Arhivēt
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPostDialog({ open: true, editing: post })}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:bg-red-50"
                      onClick={() => setDeletePostId(post.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Banners ── */}
        <TabsContent value="banners" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Reklāmas baneri lietotnē
            </h2>
            <Button size="sm" onClick={() => setBannerDialog({ open: true, editing: null })}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauns baneris
            </Button>
          </div>

          {banners.length === 0 ? (
            <EmptyState
              icon={Image}
              title="Nav baneru"
              description="Pievienojiet reklāmas banerus pircēju lietotnei."
              action={
                <Button size="sm" onClick={() => setBannerDialog({ open: true, editing: null })}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Pievienot baneri
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((banner) => (
                  <Card key={banner.id} className={!banner.active ? 'opacity-60' : ''}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground leading-tight">
                            {banner.title}
                          </p>
                          {banner.subtitle && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {banner.subtitle}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setBannerDialog({ open: true, editing: banner })}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:bg-red-50"
                            onClick={() => setDeleteBannerId(banner.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                          {BANNER_POSITION_META[banner.position]}
                        </span>
                        <span>Nr. {banner.sortOrder}</span>
                        {banner.ctaText && (
                          <span className="text-sky-600">CTA: {banner.ctaText}</span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={banner.active}
                            onChange={() => toggleBannerActive(banner.id)}
                            className="h-3.5 w-3.5 rounded"
                          />
                          <span className="text-xs text-muted-foreground">Aktīvs</span>
                        </label>
                        {banner.active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Redzams lietotnē
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Paslēpts</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 3: Audience ── */}
        <TabsContent value="audience" className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Auditorijas segmenti
          </h2>

          {statsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ielādē statistiku...
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: 'Pircēji',
                  icon: ShoppingCart,
                  value: stats.totalUsers ?? 0,
                  desc: 'Reģistrēti pircēju konti',
                  color: 'text-sky-600',
                },
                {
                  label: 'Piegādātāji',
                  icon: Store,
                  value: (stats as any).totalSuppliers ?? 0,
                  desc: 'Apstiprinātie piegādātāji',
                  color: 'text-purple-600',
                },
                {
                  label: 'Pārvadātāji',
                  icon: Truck,
                  value: (stats as any).totalDrivers ?? 0,
                  desc: 'Aktīvie pārvadātāji',
                  color: 'text-amber-600',
                },
              ].map((seg) => (
                <Card key={seg.label}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                        <seg.icon className={`h-4 w-4 ${seg.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{seg.label}</p>
                        <p className="text-xs text-muted-foreground">{seg.desc}</p>
                      </div>
                    </div>
                    <p className={`text-3xl font-bold ${seg.color}`}>
                      {seg.value.toLocaleString('lv-LV')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Nav datu"
              description="Neizdeva ielādēt auditorijas statistiku."
              action={
                <Button size="sm" variant="outline" onClick={loadStats}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Mēģināt vēlreiz
                </Button>
              }
            />
          )}

          <Card className="mt-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Push paziņojumi — drīzumā
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Mērķēti push paziņojumi pa auditorijas segmentiem tiks aktivizēti pēc Firebase Cloud
                Messaging (FCM) integrācijas.
              </p>
              <Link
                href="/dashboard/admin/broadcast"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
              >
                Doties uz apraides centru
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Analytics ── */}
        <TabsContent value="analytics" className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Platformas saturs un iesaistīšanās
          </h2>

          {statsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ielādē...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: 'Kopējie pasūtījumi',
                    value: stats?.totalOrders ?? 0,
                    icon: Package,
                    color: 'text-foreground',
                  },
                  {
                    label: 'Apgrozījums (€)',
                    value:
                      (stats as any)?.totalRevenue != null
                        ? `€${Number((stats as any).totalRevenue).toLocaleString('lv-LV', { minimumFractionDigits: 2 })}`
                        : '—',
                    icon: TrendingUp,
                    color: 'text-emerald-600',
                  },
                  {
                    label: 'Aktīvie materiāli',
                    value: materials.filter((m) => m.active).length,
                    icon: Store,
                    color: 'text-sky-600',
                  },
                ].map((kpi) => (
                  <Card key={kpi.label}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                        <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                      </div>
                      <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-sky-500" />
                    Detalizēta analītika
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Paplašināta analītika ar grafikiem un eksportu pieejama analītikas modulī.
                  </p>
                  <Link
                    href="/dashboard/analytics"
                    className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                  >
                    Skatīt pilno analītiku
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>

              {posts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Ierakstu sadalījums</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(Object.keys(POST_STATUS_META) as PostStatus[]).map((s) => {
                        const count = posts.filter((p) => p.status === s).length;
                        const pct = posts.length > 0 ? Math.round((count / posts.length) * 100) : 0;
                        return (
                          <div key={s} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-24 shrink-0">
                              {POST_STATUS_META[s].label}
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-foreground w-8 text-right">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Post Dialog ── */}
      <PostDialog
        open={postDialog.open}
        initial={postDialog.editing}
        onSave={handleSavePost}
        onClose={() => setPostDialog({ open: false, editing: null })}
      />

      {/* ── Banner Dialog ── */}
      <BannerDialog
        open={bannerDialog.open}
        initial={bannerDialog.editing}
        onSave={handleSaveBanner}
        onClose={() => setBannerDialog({ open: false, editing: null })}
      />

      {/* ── Delete post confirm ── */}
      <Dialog open={deletePostId !== null} onOpenChange={(v) => !v && setDeletePostId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst ierakstu?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Šī darbība ir neatgriezeniska. Ieraksts tiks neatgriezeniski dzēsts.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePostId(null)}>
              Atcelt
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletePostId && handleDeletePost(deletePostId)}
            >
              Dzēst
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete banner confirm ── */}
      <Dialog open={deleteBannerId !== null} onOpenChange={(v) => !v && setDeleteBannerId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst baneri?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Šī darbība ir neatgriezeniska. Baneris tiks neatgriezeniski dzēsts.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBannerId(null)}>
              Atcelt
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteBannerId && handleDeleteBanner(deleteBannerId)}
            >
              Dzēst
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
