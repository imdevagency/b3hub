---
applyTo: "apps/web/**"
---

# Web UI Component Library (apps/web)

All UI primitives live in `@/components/ui/`. Always use these before writing custom markup.
Icons come from `lucide-react` — never use emoji or raw SVG for icons.

---

## Layout & structure

### `<Card>` / `<CardHeader>` / `<CardTitle>` / `<CardContent>` / `<CardFooter>`
White rounded panel with a shadow. Use for every content block on a page.
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Orders</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

---

### `<PageHeader>` ⭐
**Use this as the FIRST element of every dashboard page.** Provides a consistent title row with optional description and action button slot.
```tsx
import { PageHeader } from '@/components/ui/page-header';

// Minimal
<PageHeader title="Pasūtījumi" />

// With description + action
<PageHeader
  title="Mani Materiāli"
  description="Izveidojiet un rediģējiet materiālu sarakstus"
  action={<Button onClick={openForm}><Plus className="h-4 w-4 mr-1.5" />Jauns materiāls</Button>}
/>

// Multiple actions
<PageHeader
  title="Darbu Tirgus"
  action={
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={refresh}><RefreshCw className="h-4 w-4" /></Button>
      <Button onClick={openFilter}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filtri</Button>
    </div>
  }
/>
```

---

### `<EmptyState>` ⭐
**Use whenever a list or data section has no items.** Never write inline empty-state divs.
```tsx
import { EmptyState } from '@/components/ui/empty-state';

// Minimal
{orders.length === 0 && (
  <EmptyState icon={ClipboardList} title="Nav pasūtījumu" />
)}

// Full
<EmptyState
  icon={Package}
  title="Nav materiālu"
  description="Pievienojiet pirmo materiālu, lai sāktu saņemt pasūtījumus"
  action={<Button onClick={openForm}><Plus className="h-4 w-4 mr-1.5" />Pievienot materiālu</Button>}
/>
```

---

### `<PageAnimate>` (internal — already wired in layout)
Triggers a fade+rise animation on every route change. It lives in `dashboard/layout.tsx` and wraps all dashboard `{children}`.
**Do NOT add `animate-in` classes to page root elements** — the layout already handles it.

---

## Buttons

### `<Button>`
```tsx
import { Button } from '@/components/ui/button';

// variants: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
// sizes:    'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'

<Button>Submit</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost" size="icon"><Trash2 /></Button>
```

---

## Form elements

### `<Input>`
```tsx
import { Input } from '@/components/ui/input';
<Input placeholder="Search..." value={v} onChange={...} />
```

### `<Textarea>`
```tsx
import { Textarea } from '@/components/ui/textarea';
```

### `<Label>`
```tsx
import { Label } from '@/components/ui/label';
<Label htmlFor="email">Email</Label>
```

### `<Select>` / `<SelectTrigger>` / `<SelectContent>` / `<SelectItem>`
```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

<Select value={v} onValueChange={setV}>
  <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
  </SelectContent>
</Select>
```

### `<Form>` + react-hook-form integration
Use the `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` wrappers from `@/components/ui/form` with `react-hook-form`.

### `<Switch>`
```tsx
import { Switch } from '@/components/ui/switch';
<Switch checked={enabled} onCheckedChange={setEnabled} />
```

### `<Calendar>`
Radix-based date picker. Import from `@/components/ui/calendar`.

---

## Feedback & status

### `<Badge>`
```tsx
import { Badge } from '@/components/ui/badge';
// variants: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
<Badge variant="secondary">Pending</Badge>
```

### `<Skeleton>`
Loading placeholder. Use instead of spinners inside cards.
```tsx
import { Skeleton } from '@/components/ui/skeleton';
<Skeleton className="h-4 w-48" />
<Skeleton className="h-10 w-full" />
```

### `<PageSpinner>`
Full-section loading state. Use when the entire page content is loading.
```tsx
import { PageSpinner } from '@/components/ui/page-spinner';
if (loading) return <PageSpinner />;
```

### `<Tooltip>` / `<TooltipTrigger>` / `<TooltipContent>`
```tsx
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
```

---

## Overlays

### `<Dialog>` / `<DialogTrigger>` / `<DialogContent>` / `<DialogHeader>` / `<DialogTitle>` / `<DialogFooter>`
Modal dialogs. Always use this instead of custom modal implementations.
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
```

### `<Sheet>` / `<SheetTrigger>` / `<SheetContent>`
Slide-in side panel (right or bottom). Use for settings panels and detail drawers.
```tsx
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
<SheetContent side="right">...</SheetContent>
```

### `<DropdownMenu>` + subcomponents
```tsx
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
```

---

## Navigation

### `<NavigationMenu>` + subcomponents
Top-level nav bars. Import from `@/components/ui/navigation-menu`.

### `<Breadcrumb>` + subcomponents
```tsx
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb';
```

### `<Sidebar>` and `<AppSidebar>`
The main sidebar layout lives in `@/components/app-sidebar.tsx` and uses the primitives from `@/components/ui/sidebar.tsx`. Do not create custom sidebars.

---

## Data display

### `<Avatar>` / `<AvatarImage>` / `<AvatarFallback>`
```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
```

### `<Separator>`
Horizontal or vertical rule. Replaces `<hr>` or inline border Views.
```tsx
import { Separator } from '@/components/ui/separator';
<Separator />
<Separator orientation="vertical" />
```

### `<Collapsible>` / `<CollapsibleTrigger>` / `<CollapsibleContent>`
Toggle-able disclosure panel. Import from `@/components/ui/collapsible`.

---

## Address input

### `<AddressAutocomplete>`
Google Maps address autocomplete input for forms.
```tsx
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
<AddressAutocomplete
  value={address}
  onChange={({ address, lat, lng }) => { ... }}
  placeholder="Enter delivery address"
/>
```

---

## Domain components

### `<DashboardGuard>`
Protects pages that require an authenticated seller/admin session.
`@/components/dashboard-guard.tsx`

### `<NotificationBell>`
Top-bar notification icon with unread count badge.
`@/components/notification-bell.tsx`

### `<ErrorBoundary>`
Wrap page sections that may throw.
`@/components/error-boundary.tsx`

---

## Conventions

- Use `cn()` from `@/lib/utils` to merge class names (never string concatenation).
- Use `lucide-react` for all icons.
- Use `@/components/ui/form` + `react-hook-form` + `zod` for all forms.
- Never write inline `style={{}}` for layout — use Tailwind classes.
- Loading state → `<PageSpinner />` (full section) or `<Skeleton />` (inside cards).
- **Every dashboard page must start with `<PageHeader title="..." />`.** Never write your own `<h1>` or title div.
- **Empty state → `<EmptyState icon={X} title="..." />`.** Never write your own empty-state div block; never use "Empty state → `<Card>` with a centered message" again.
- **Page entry animation is automatic** via `<PageAnimate>` in the dashboard layout — never add `animate-in` or transition classes to a page's root element manually.
- Never hardcode raw color values in Tailwind classes inside dashboard pages (`bg-red-600`, `bg-gray-100`, etc.). Use semantic tokens: `bg-primary`, `bg-muted`, `bg-destructive`, `text-muted-foreground`, etc.
- Never write `<div className="bg-white border rounded-2xl p-5 shadow-sm">` as a card — use `<Card>` from `@/components/ui/card` with the appropriate `CardHeader`/`CardContent` structure.
- For status badges use `<StatusBadgeHex>` / `<InvoiceStatusBadge>` from `@/lib/status-config` — never write inline `<span style={{ backgroundColor, color }}>` for a status pill.

<!-- GEN:component-api -->
#### `AddressAutocomplete` — `@/components/ui/AddressAutocomplete`

**Exports:** `AddressAutocomplete`

---

#### `avatar` — `@/components/ui/avatar`

---

#### `badge` — `@/components/ui/badge`

---

#### `breadcrumb` — `@/components/ui/breadcrumb`

---

#### `button` — `@/components/ui/button`
- **size:** `icon-xs` | `icon-sm` | `icon-lg`

---

#### `calendar` — `@/components/ui/calendar`

---

#### `card` — `@/components/ui/card`

---

#### `collapsible` — `@/components/ui/collapsible`

---

#### `dialog` — `@/components/ui/dialog`

---

#### `dropdown-menu` — `@/components/ui/dropdown-menu`

---

#### `empty-state` — `@/components/ui/empty-state`

| Prop | Type | |
|------|------|---|
| `icon` | `LucideIcon` | **required** |
| `title` | `string` | **required** |
| `description` | `string` | optional |
| `action` | `React.ReactNode` | optional |
| `className` | `string` | optional |

**Exports:** `EmptyState`

---

#### `form` — `@/components/ui/form`

---

#### `input` — `@/components/ui/input`

---

#### `label` — `@/components/ui/label`

---

#### `navigation-menu` — `@/components/ui/navigation-menu`

---

#### `page-animate` — `@/components/ui/page-animate`

**Exports:** `PageAnimate`

---

#### `page-header` — `@/components/ui/page-header`

| Prop | Type | |
|------|------|---|
| `title` | `string` | **required** |
| `description` | `string` | optional |
| `action` | `React.ReactNode` | optional |
| `className` | `string` | optional |

**Exports:** `PageHeader`

---

#### `page-spinner` — `@/components/ui/page-spinner`

| Prop | Type | |
|------|------|---|
| `className` | `string` | optional |

**Exports:** `PageSpinner`

---

#### `select` — `@/components/ui/select`

---

#### `separator` — `@/components/ui/separator`

---

#### `sheet` — `@/components/ui/sheet`

---

#### `sidebar` — `@/components/ui/sidebar`

---

#### `skeleton` — `@/components/ui/skeleton`

---

#### `switch` — `@/components/ui/switch`

---

#### `textarea` — `@/components/ui/textarea`

---

#### `tooltip` — `@/components/ui/tooltip`
<!-- END GEN -->
