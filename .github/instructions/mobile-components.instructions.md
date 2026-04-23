---
applyTo: 'apps/mobile/**'
---

# Mobile UI Component Library (apps/mobile)

All UI primitives live in `@/components/ui/`. Always use these before creating custom styled Views.
Icons come from `lucide-react-native` — do not use emoji or raw SVG.
Styling uses **NativeWind** (Tailwind class names via `className`). Avoid `StyleSheet.create` unless required for animations or native-only properties.

---

## Design tokens

All tokens are defined in `apps/mobile/lib/tokens.js` (CommonJS, required by Tailwind) and re-exported from `@/lib/theme` (typed TypeScript). **NativeWind class names are available everywhere — no import needed.**

### Colour classes (`bg-*`, `text-*`, `border-*`)

| Class                                 | Token      | Usage                              |
| ------------------------------------- | ---------- | ---------------------------------- |
| `bg-screen`                           | `#F4F5F7`  | Every screen background            |
| `bg-card`                             | `#FFFFFF`  | Cards, list items, panels          |
| `bg-subtle`                           | `#F9FAFB`  | Subtle fill sections               |
| `bg-muted`                            | `#EFF1F5`  | Input backgrounds, disabled states |
| `bg-primary`                          | `#00A878`  | Primary action backgrounds         |
| `text-text-primary`                   | `#111827`  | Body text                          |
| `text-text-secondary`                 | `#374151`  | Secondary labels                   |
| `text-text-muted`                     | `#6B7280`  | Captions, placeholders             |
| `text-text-disabled`                  | `#9CA3AF`  | Disabled text                      |
| `border-border`                       | `#E5E7EB`  | Default borders/dividers           |
| `border-border-focus`                 | `#00A878`  | Focused inputs                     |
| `bg-success-bg` / `text-success-text` | green pair | Status badges                      |
| `bg-warning-bg` / `text-warning-text` | amber pair | Status badges                      |
| `bg-danger-bg` / `text-danger-text`   | red pair   | Status badges                      |

### Spacing classes (`p-*`, `m-*`, `gap-*`, `px-*`, …)

| Class                 | Value |
| --------------------- | ----- |
| `p-xs` / `gap-xs`     | 4 px  |
| `p-sm` / `gap-sm`     | 8 px  |
| `p-md` / `gap-md`     | 12 px |
| `p-base` / `gap-base` | 16 px |
| `p-lg` / `gap-lg`     | 20 px |
| `p-xl` / `gap-xl`     | 24 px |
| `p-2xl` / `gap-2xl`   | 32 px |
| `p-3xl` / `gap-3xl`   | 48 px |

### Border-radius classes

`rounded-sm` (6), `rounded-md` (10), `rounded-lg` (14), `rounded-xl` (20), `rounded-full` (9999)

### When to use StyleSheet instead of className

> **See also: `.github/instructions/mobile-styling.instructions.md`** — complete rules for what must go in `style` vs `className` (arbitrary values, font weights, shadows, dynamic values).

Only use `StyleSheet.create` + `@/lib/theme` imports for values that are **not expressible as Tailwind classes**: exact pixel offsets in transforms, shadow objects, dynamic computed values. Import like:

```tsx
import { colors, spacing, radius, fontSizes, shadows } from '@/lib/theme';
// colors.textMuted, spacing.base, radius.lg, shadows.card …
```

**Never hardcode** hex colours, pixel values, or font sizes directly — always use a token or class.

---

## Screen structure

### `<ScreenContainer>`

**Mandatory wrapper for every screen.** Handles safe area insets and a fade-in animation.

```tsx
import { ScreenContainer } from '@/components/ui/ScreenContainer';

// Default (inside tab navigator — top inset managed by TopBar):
<ScreenContainer>...</ScreenContainer>

// Standalone screen (not in tabs — owns its own top inset):
<ScreenContainer standalone>...</ScreenContainer>

// Custom background:
<ScreenContainer bg="#ffffff">...</ScreenContainer>

// Props: bg?, standalone?, topInset?, style?, noAnimation?
```

### `<ScreenHeader>`

Back-navigation header for standalone/detail screens.

```tsx
import { ScreenHeader } from '@/components/ui/ScreenHeader';

<ScreenHeader title="Order Details" />
<ScreenHeader title="Settings" rightSlot={<EditButton />} />
<ScreenHeader title="Map" onBack={() => router.push('/(buyer)/orders')} />

// Props: title, onBack?, rightSlot?, style?, withTopInset?
```

### `<TopBar>`

The main app navigation bar (included automatically by the tab layout). Do not add a second TopBar in individual screens.

---

## Content blocks

### `<InfoSection>`

White rounded card with an icon + uppercase title header. **Use for every named section on detail screens.** Replaces hand-rolled `sectionHeader` / `sectionTitle` Views.

```tsx
import { InfoSection } from '@/components/ui/InfoSection';
import { DetailRow } from '@/components/ui/DetailRow';

<InfoSection icon={<MapPin size={14} color="#6b7280" />} title="Delivery">
  <DetailRow label="Address" value={order.deliveryAddress} />
  <DetailRow label="City"    value={order.deliveryCity} last />
</InfoSection>

// With right slot in header:
<InfoSection title="Weight ticket" right={<Text>12 000 kg</Text>}>
  <Image ... />
</InfoSection>

// Props: title, icon?, right?, children
```

### `<DetailRow>`

Label + value pair inside an `InfoSection`. Renders nothing when value is falsy.

```tsx
import { DetailRow } from '@/components/ui/DetailRow';

<DetailRow label="Material"  value={order.materialName} />
<DetailRow label="Quantity"  value={`${order.quantity} t`} />
<DetailRow label="Date"      value={formatDate(order.date)} last />

// Props: label, value?, last?
// last=true removes bottom border (avoids double border with parent card)
```

### `<PriceRow>` ⭐

**Use for every price breakdown line.** Replaces the repeated
`<View style={m.lineItem}><Text label/><Text value/></View>` pattern
in invoice modals, order detail screens, and earnings pages.

```tsx
import { PriceRow } from '@/components/ui/PriceRow';

<PriceRow label="Summa bez PVN" amount={order.subtotal} />
<PriceRow label="PVN (21%)"     amount={order.tax} />
<PriceRow label="Piegāde"       amount={order.deliveryFee} />
<PriceRow label="Kopā"          amount={order.total} total />

// Custom formatted value:
<PriceRow label="Daudzums" value="12 t" />

// Highlighted value (overdue, error):
<PriceRow label="Termiņš" value="15. maijs" valueColor="#dc2626" />

// Props: label, amount? (→ formats as €X.XX), value? (pre-formatted string),
//        total? (bold both sides + top border), valueColor?
```

---

## Buttons & interactivity

### `<Button>`

```tsx
import { Button } from '@/components/ui/button';

// variants: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
// sizes:    'default' | 'sm' | 'lg' | 'icon'

<Button onPress={handleSubmit}>Confirm order</Button>
<Button variant="outline" onPress={goBack}>Cancel</Button>
<Button variant="destructive" isLoading={saving}>Delete</Button>
<Button variant="secondary" size="sm">View details</Button>

// Props: variant?, size?, isLoading?, textColor?, + all Pressable props
```

---

## Typography

### `<Text>`

Typed text primitive with `variant` and `size` props. Prefer over raw `<Text>` from react-native.

```tsx
import { Text } from '@/components/ui/text';

<Text>Normal text</Text>
<Text variant="muted" size="sm">Secondary info</Text>
<Text variant="destructive">Error message</Text>
<Text size="xl">Heading</Text>

// variants: 'default' | 'muted' | 'destructive'
// sizes:    'default' | 'sm' | 'lg' | 'xl'
```

---

## Status & labels

### `<OrderStatusBadge>` / `<JobStatusBadge>` ⭐

**Preferred for order and transport-job statuses.** Looks up the canonical Latvian label and
brand colours automatically from `lib/status.ts` — no local status maps or raw hex needed.

```tsx
import { OrderStatusBadge, JobStatusBadge } from '@/components/ui/OrderStatusBadge';

// Order status — resolves label + colours from ORDER_STATUS_MAP:
<OrderStatusBadge status={order.status} />
<OrderStatusBadge status={order.status} size="md" />

// Transport job status — resolves from JOB_STATUS_MAP:
<JobStatusBadge status={job.status} />

// Custom label override (e.g. driver-side phrasing):
<JobStatusBadge status={job.status} label="Dodas pie jums" size="sm" />

// Props: status, label? (override), size? ('sm' | 'md')
```

> Use `<StatusPill>` directly only for non-order/job statuses (invoices, documents, disputes)
> that do not map to the canonical order/job enums.

### `<StatusPill>`

Low-level coloured status badge. Use for entity-specific statuses not covered by
`OrderStatusBadge` / `JobStatusBadge`.

```tsx
import { StatusPill } from '@/components/ui/StatusPill';

<StatusPill label="Apmaksāts" bg="#dcfce7" color="#15803d" />
<StatusPill label="Kavēts"    bg="#fee2e2" color="#dc2626" size="sm" />

// Props: label, bg, color, size? ('sm' | 'md')
// size="sm" → compact inline pill (list rows)
// size="md" → standard pill (card headers, detail pages)
```

### `<SectionLabel>`

Uppercase grey section header text used above list groups and form sections.

```tsx
import { SectionLabel } from '@/components/ui/SectionLabel';

<SectionLabel label="RECENT ORDERS" />
<SectionLabel label="VEHICLE DETAILS" style={{ marginTop: 24 }} />

// Props: label, style?
```

---

## Separators & spacing

### `<Divider>`

Thin horizontal rule. Replaces `<View style={{ height:1, backgroundColor:'#e5e7eb' }}>`.

```tsx
import { Divider } from '@/components/ui/Divider';

<Divider />
<Divider color="#e5e7eb" marginV={8} />

// Props: color? (default '#f3f4f6'), marginV? (default 0)
```

---

## Empty & loading states

### `<EmptyState>`

Centered placeholder for zero-data lists and pages.

```tsx
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText } from 'lucide-react-native';

// As ListEmptyComponent (parent FlatList needs contentContainerStyle={{ flexGrow: 1 }}):
<EmptyState
  icon={<FileText size={32} color="#9ca3af" />}
  title="No orders yet"
  subtitle="Your orders will appear here once placed."
  action={<Button onPress={goCreate}>Place first order</Button>}
/>;

// Props: title, icon?, subtitle?, action?
```

### `<Skeleton>` / `<SkeletonCard>` / `<SkeletonDetail>` / `<SkeletonJobRow>`

**⚠ REQUIRED: Every screen that fetches data MUST show a skeleton while `loading === true`.  
No spinners. No blank screens. No conditional renders that return `null` during fetch.**

All skeleton components are exported from `@/components/ui/Skeleton`.

```tsx
import { Skeleton, SkeletonCard, SkeletonDetail, SkeletonJobRow } from '@/components/ui/Skeleton';

// List screen — wrap in ScreenContainer + ScreenHeader then show SkeletonCard:
if (loading) {
  return (
    <ScreenContainer standalone>
      <ScreenHeader title="Pasūtījumi" />
      <SkeletonCard count={4} />
    </ScreenContainer>
  );
}

// Detail screen — use SkeletonDetail:
if (loading) {
  return (
    <ScreenContainer standalone>
      <ScreenHeader title="Detaļas" />
      <SkeletonDetail />
    </ScreenContainer>
  );
}

// Driver jobs — use SkeletonJobRow:
if (loading) return <SkeletonJobRow count={5} />;

// Home screen — use SkeletonHome:
import { SkeletonHome } from '@/components/ui/Skeleton';
if (loading) return <SkeletonHome />;

// Inline single-line placeholder:
<Skeleton width="60%" height={14} />;
```

Choose the preset that matches the content:

| Component        | Use for                                         |
| ---------------- | ----------------------------------------------- |
| `SkeletonCard`   | Order/invoice/material list screens             |
| `SkeletonDetail` | Full-page detail screens (order, job, contract) |
| `SkeletonJobRow` | Driver job board lists                          |
| `SkeletonHome`   | Home tab screens with stat strips               |
| `Skeleton`       | Inline placeholders inside a card               |

---

## Overlays

### `<BottomSheet>`

Slide-up modal panel. Use instead of custom Modal implementations.

```tsx
import { BottomSheet } from '@/components/ui/BottomSheet';

<BottomSheet visible={open} onClose={() => setOpen(false)} title="Filter orders">
  {/* filter controls */}
</BottomSheet>;

// Props: visible, onClose, title?, subtitle?, hideHandle?, scrollable?, maxHeightPct?, children
```

### `<Toast>`

Imperative toast notifications. Import from `@/components/ui/Toast`.

### `<RatingModal>`

Order/driver rating flow. Import from `@/components/ui/RatingModal`.

---

## Address input

### `<AddressPicker>`

Full-screen address picker with map + autocomplete. Use on any form that needs a delivery or pickup location.

```tsx
import { AddressPicker } from '@/components/ui/AddressPicker';

<AddressPicker
  visible={open}
  title="Pickup location"
  initialAddress={address}
  initialLat={lat}
  initialLng={lng}
  onConfirm={({ address, lat, lng }) => {
    setAddress(address);
    setOpen(false);
  }}
  onClose={() => setOpen(false)}
/>;

// Props: visible, onClose, onConfirm, title?, initialAddress?, initialLat?, initialLng?
```

---

## Navigation & chrome

### `<AnimatedTabBar>`

Custom bottom tab bar registered in the tab navigator layout. Do not instantiate it directly in screens.

### `<ModeSwitcher>`

Buyer / Driver / Seller role switcher in the TopBar. Do not duplicate this logic in screens.

---

## Domain components (non-ui/)

### `components/driver/`

Driver-specific list items and job cards. Check this folder before building new driver UI.

### `components/order/`

Order card, order status row, and related components.

### `components/wizard/`

Multi-step form wizard primitives used by order creation and skip-hire flows.

### `components/map/`

`<BaseMap>`, `<JobRouteMap>`, `useGeocode()` — always use these for any map rendering.

---

## Conventions

- **Every screen must be wrapped in `<ScreenContainer>`.**
- **Detail screens must use `<ScreenHeader>` for back navigation.**
- **Named content sections must use `<InfoSection>` + `<DetailRow>`.**
- **Order and job statuses must use `<OrderStatusBadge>` / `<JobStatusBadge>`. Never duplicate a local `getStatusMeta` function — the canonical maps are in `lib/status.ts`.**
- **Other entity statuses (invoice, document, dispute) use `<StatusPill>` with values from a local map. Never pass raw hex literals for status colours inline — define a typed status-meta constant.**
- **Price breakdowns must use `<PriceRow>`. Never repeat `<View style={lineItem}><Text label/><Text value/></View>` inline.**
- **Empty lists must use `<EmptyState>` as `ListEmptyComponent`.**
- **⚠ Every screen that fetches async data MUST show a skeleton while `loading === true`. Use `SkeletonCard` for lists, `SkeletonDetail` for detail screens, `SkeletonJobRow` for driver job lists, `SkeletonHome` for home tabs. Never show a spinner (`ActivityIndicator`) as the primary loading state. Never return `null` or a blank screen while data loads.**
- **For within-screen entrance animations, use `<FadeInView>` from `@/components/ui/FadeInView` — never add raw `Animated.Value` setups for simple fade/slide-in effects.**
  - Page sections: `<FadeInView>` (default `fadeSlideUp`)
  - Staggered list cards: `<FadeInView variant="card" index={i}>`
  - Modal sheet content: `<FadeInView variant="slideUp">`
- **Never hardcode animation durations or spring configs.** Import from `@/lib/transitions` — `DURATION`, `spring`, `entering`, `SCREEN`.
- **Never add `animation` / `animationDuration` to a `<Stack.Screen>` directly.** Use the presets: `SCREEN.push`, `SCREEN.modal`, `SCREEN.fade`, `SCREEN.none`.
- Use `haptics` from `@/lib/haptics` on all button presses: `haptics.light()`, `haptics.medium()`, `haptics.success()`, `haptics.error()`.
- Never call `fetch` directly in a component — add an API function in `lib/api/` and call it via a hook.
- Translations: use `t.xxx` from `@/lib/translations` for all user-visible strings.

<!-- GEN:component-api -->

#### `ActionResultSheet` — `@/components/ui/ActionResultSheet`

| Prop             | Type                  |              |
| ---------------- | --------------------- | ------------ |
| `visible`        | `boolean`             | **required** |
| `onClose`        | `() => void`          | **required** |
| `variant`        | `ActionResultVariant` | **required** |
| `title`          | `string`              | **required** |
| `subtitle`       | `string`              | optional     |
| `primaryLabel`   | `string`              | **required** |
| `onPrimary`      | `() => void`          | **required** |
| `secondaryLabel` | `string`              | optional     |
| `onSecondary`    | `() => void`          | optional     |

**Exports:** `ActionResultSheet`

---

#### `AddressPicker` — `@/components/ui/AddressPicker`

| Prop             | Type                            |              |
| ---------------- | ------------------------------- | ------------ |
| `visible`        | `boolean`                       | **required** |
| `title`          | `string`                        | optional     |
| `initialAddress` | `string`                        | optional     |
| `initialLat`     | `number`                        | optional     |
| `initialLng`     | `number`                        | optional     |
| `onConfirm`      | `(loc: PickedLocation) => void` | **required** |
| `onClose`        | `() => void`                    | **required** |
| `pinColor`       | `string`                        | optional     |

**Exports:** `AddressPicker`

---

#### `AnimatedTabBar` — `@/components/ui/AnimatedTabBar`

| Prop                 | Type                                                      |          |
| -------------------- | --------------------------------------------------------- | -------- |
| `activeTint`         | `string`                                                  | optional |
| `inactiveTint`       | `string`                                                  | optional |
| `ctaTab`             | `CtaTabConfig`                                            | optional |
| `hiddenRouteAliases` | `Record<string, string>`                                  | optional |
| `onRoutePress`       | `(routeName: string, defaultHandler: () => void) => void` | optional |

**Exports:** `AnimatedTabBar`

---

#### `BottomSheet` — `@/components/ui/BottomSheet`

| Prop           | Type              |              |
| -------------- | ----------------- | ------------ |
| `visible`      | `boolean`         | **required** |
| `onClose`      | `() => void`      | **required** |
| `title`        | `string`          | optional     |
| `subtitle`     | `string`          | optional     |
| `hideHandle`   | `boolean`         | optional     |
| `scrollable`   | `boolean`         | optional     |
| `maxHeightPct` | `number`          | optional     |
| `children`     | `React.ReactNode` | **required** |

**Exports:** `BottomSheet`

---

#### `DetailRow` — `@/components/ui/DetailRow`

| Prop    | Type              |              |
| ------- | ----------------- | ------------ |
| `label` | `string`          | **required** |
| `value` | `React.ReactNode` | optional     |
| `last`  | `boolean`         | optional     |

**Exports:** `DetailRow`

---

#### `Divider` — `@/components/ui/Divider`

| Prop      | Type     |          |
| --------- | -------- | -------- |
| `color`   | `string` | optional |
| `marginV` | `number` | optional |

**Exports:** `Divider`

---

#### `EmptyState` — `@/components/ui/EmptyState`

| Prop       | Type              |              |
| ---------- | ----------------- | ------------ |
| `icon`     | `React.ReactNode` | optional     |
| `title`    | `string`          | **required** |
| `subtitle` | `string`          | optional     |
| `action`   | `React.ReactNode` | optional     |

**Exports:** `EmptyState`

---

#### `ErrorBoundary` — `@/components/ui/ErrorBoundary`

_No props interface — check source file._

**Exports:** `ErrorBoundary`

---

#### `FadeInView` — `@/components/ui/FadeInView`

| Prop       | Type                   |              |
| ---------- | ---------------------- | ------------ |
| `children` | `React.ReactNode`      | **required** |
| `variant`  | `FadeInVariant`        | optional     |
| `index`    | `number`               | optional     |
| `delay`    | `number`               | optional     |
| `style`    | `StyleProp<ViewStyle>` | optional     |

**Exports:** `FadeInView`

---

#### `InfoSection` — `@/components/ui/InfoSection`

| Prop       | Type              |              |
| ---------- | ----------------- | ------------ |
| `icon`     | `React.ReactNode` | optional     |
| `title`    | `string`          | **required** |
| `right`    | `React.ReactNode` | optional     |
| `children` | `React.ReactNode` | optional     |

**Exports:** `InfoSection`

---

#### `JobRouteMap` — `@/components/ui/JobRouteMap`

| Prop                    | Type         |              |
| ----------------------- | ------------ | ------------ | -------- | -------- |
| `pickup`                | `MapPin`     | **required** |
| `delivery`              | `MapPin`     | **required** |
| `current`               | `MapPin      | null`        | optional |
| `extras`                | `ExtraPin[]` | optional     |
| `height`                | `number      | string       | null`    | optional |
| `borderRadius`          | `number`     | optional     |
| `style`                 | `ViewStyle`  | optional     |
| `showToPickupLeg`       | `boolean`    | optional     |
| `followCurrentPosition` | `boolean`    | optional     |

**Exports:** `JobRouteMap`

---

#### `ModeSwitcher` — `@/components/ui/ModeSwitcher`

_No props interface — check source file._

**Exports:** `ModeSwitcher`

---

#### `OfflineBanner` — `@/components/ui/OfflineBanner`

_No props interface — check source file._

**Exports:** `OfflineBanner`

---

#### `RatingModal` — `@/components/ui/RatingModal`

_No props interface — check source file._

**Exports:** `RatingModal`

---

#### `ScreenContainer` — `@/components/ui/ScreenContainer`

| Prop          | Type              |              |
| ------------- | ----------------- | ------------ |
| `children`    | `React.ReactNode` | **required** |
| `bg`          | `string`          | optional     |
| `topBg`       | `string`          | optional     |
| `standalone`  | `boolean`         | optional     |
| `topInset`    | `number`          | optional     |
| `style`       | `ViewStyle`       | optional     |
| `noAnimation` | `boolean`         | optional     |

**Exports:** `ScreenContainer`

---

#### `ScreenHeader` — `@/components/ui/ScreenHeader`

| Prop          | Type              |              |
| ------------- | ----------------- | ------------ | -------- |
| `title`       | `string`          | **required** |
| `rightAction` | `React.ReactNode` | optional     |
| `onBack`      | `(() => void)     | null`        | optional |
| `showBack`    | `boolean`         | optional     |
| `noBorder`    | `boolean`         | optional     |

**Exports:** `ScreenHeader`

---

#### `SectionLabel` — `@/components/ui/SectionLabel`

_No props interface — check source file._

**Exports:** `SectionLabel`

---

#### `Sidebar` — `@/components/ui/Sidebar`

| Prop          | Type         |              |
| ------------- | ------------ | ------------ |
| `visible`     | `boolean`    | **required** |
| `onClose`     | `() => void` | **required** |
| `role`        | `Role`       | **required** |
| `accentColor` | `string`     | **required** |

**Exports:** `Sidebar`

---

#### `Skeleton` — `@/components/ui/Skeleton`

| Prop     | Type        |               |
| -------- | ----------- | ------------- | -------- |
| `width`  | `number     | `${number}%`` | optional |
| `height` | `number`    | optional      |
| `radius` | `number`    | optional      |
| `style`  | `ViewStyle` | optional      |

**Exports:** `Skeleton`, `SkeletonCard`, `SkeletonHome`, `SkeletonDetail`, `SkeletonJobRow`

---

#### `StatusPill` — `@/components/ui/StatusPill`

| Prop    | Type     |              |
| ------- | -------- | ------------ | -------- |
| `label` | `string` | **required** |
| `bg`    | `string` | **required** |
| `color` | `string` | **required** |
| `size`  | `'sm'    | 'md'`        | optional |

**Exports:** `StatusPill`

---

#### `TextInputField` — `@/components/ui/TextInputField`

| Prop                 | Type        |          |
| -------------------- | ----------- | -------- |
| `label`              | `string`    | optional |
| `error`              | `string`    | optional |
| `hint`               | `string`    | optional |
| `containerStyle`     | `ViewStyle` | optional |
| `inputStyle`         | `TextStyle` | optional |
| `required`           | `boolean`   | optional |
| `accessibilityLabel` | `string`    | optional |
| `fullWidth`          | `boolean`   | optional |

**Exports:** `TextInputField`

---

#### `Toast` — `@/components/ui/Toast`

_No props interface — check source file._

**Exports:** `useToast`, `ToastProvider`

---

#### `TopBar` — `@/components/ui/TopBar`

| Prop            | Type              |          |
| --------------- | ----------------- | -------- |
| `title`         | `string`          | optional |
| `accentColor`   | `string`          | optional |
| `onMenuPress`   | `() => void`      | optional |
| `unreadCount`   | `number`          | optional |
| `leftElement`   | `React.ReactNode` | optional |
| `centerElement` | `React.ReactNode` | optional |
| `rightElement`  | `React.ReactNode` | optional |
| `transparent`   | `boolean`         | optional |

**Exports:** `RoleSheet`, `TopBar`

---

#### `TruckIllustration` — `@/components/ui/TruckIllustration`

| Prop     | Type        |              |
| -------- | ----------- | ------------ |
| `type`   | `TruckType` | **required** |
| `height` | `number`    | optional     |
| `width`  | `number`    | optional     |
| `onDark` | `boolean`   | optional     |

**Exports:** `TruckIllustration`

---

#### `button` — `@/components/ui/button`

| Prop        | Type      |          |
| ----------- | --------- | -------- |
| `className` | `string`  | optional |
| `isLoading` | `boolean` | optional |
| `textColor` | `string`  | optional |

---

#### `text` — `@/components/ui/text`

| Prop        | Type     |          |
| ----------- | -------- | -------- |
| `className` | `string` | optional |

<!-- END GEN -->
