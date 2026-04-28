---
applyTo: 'apps/mobile/**'
---

# Mobile User Flows & Screen Patterns (apps/mobile)

This file documents **when** and **how** to use each screen pattern. Use it before building any new flow or screen.

---

## Core rule: grep before you build

Before creating any new component, sheet, screen, or state for a flow, search the codebase first:

- If a full wizard screen exists → **navigate to it**, don't replicate steps in a sheet
- If a details screen exists → **edit it**, don't build a parallel one
- "Improve X" means **edit X**, not build a new X alongside it

---

## Screen hierarchy

```
Live tracking screen  (index.tsx)   ← map-first, real-time, minimal chrome
Details screen        (details.tsx) ← full order info, payment, documents
Wizard steps          (wizards/)    ← multi-step order creation
```

---

## Live tracking screen pattern (`index.tsx`)

Used for: `order/[id]/index.tsx`, `skip-order/[id]/index.tsx`, `transport-job/[id]/index.tsx`

**Layout:**

- `<ScreenContainer bg="#FFFFFF" standalone>` — no default header
- Full-screen map underneath via `StyleSheet.absoluteFillObject`
- Floating top pill: `ChevronLeft` (back) | order number title | `MessageCircle` (→ help)
- Uber/Bolt-style bottom sheet docked to bottom edge (`bottomSheetWrapper` + safe area padding)
- `bottomSheetContent` contains: courier header row, timeline, footer actions

**Top-right icon rule:**

- Always `MessageCircle` → `router.push('/(shared)/help')` — **never** a direct link to details from the icon
- Details access is always in the footer button row (see below)

**Footer button row (always present):**

```tsx
<View style={styles.cardActions}>
  <Button
    variant="secondary"
    size="lg"
    className="flex-1 mr-2"
    onPress={() => router.push(`/(buyer)/<type>/${id}/details`)}
  >
    Detaļas
  </Button>
  {/* Conditional secondary action inline, e.g. cancel or re-order */}
</View>
```

**Conditional footer actions:**
| Condition | Button |
|---|---|
| `isSearching` (transport) | "Atcelt" destructive, `className="flex-1 ml-2"` |
| `isTerminal` (skip-order) | "Pasūtīt vēlreiz" default slate, `className="flex-1 ml-2"` |
| `isTerminal` (order) | No extra button — Detaļas alone |

**Status colours (ORANGE constant per screen):**

- `order/index.tsx` → `#10b981` (green)
- `skip-order/index.tsx` → `#f97316` (orange)
- `transport-job/index.tsx` → `#4f46e5` (indigo)

---

## Details screen pattern (`details.tsx`)

Used for: `order/[id]/details.tsx`, `skip-order/[id]/details.tsx`, `transport-job/[id]/details.tsx`

**Layout:**

```tsx
<ScreenContainer bg="#FFFFFF" standalone>
  {/* Custom header */}
  <View style={styles.topPill}>
    <TouchableOpacity onPress={back}>
      <ChevronLeft />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>...</Text>
    <View style={styles.headerBtn} /> {/* spacer — no right action */}
  </View>

  <ScrollView contentContainerStyle={styles.scrollContent}>
    {/* headerSpacer: height 48 */}

    {/* Sections separated by 8px #F3F4F6 dividers */}
    <View style={styles.cardSection}>...</View>
    <View style={styles.divider} />

    {/* Courier/driver row */}
    <View style={styles.titleRow}>
      <View style={styles.titleLeft}>
        {' '}
        {/* flex:1, paddingRight:16 */}
        <Text style={styles.titleText} />
        <Text style={styles.titleSub} />
      </View>
      <View style={styles.avatarCircle}>
        {' '}
        {/* 48x48, borderRadius 24 */}
        ...
      </View>
    </View>
  </ScrollView>
</ScreenContainer>
```

**titleLeft rule:** Always `flex: 1, paddingRight: 16` — never `width: '100%'`. Using `width: '100%'` pushes the avatar circle off-screen.

**Section headings:** `Inter_700Bold`, 20px, `#111827`

**Detail rows:** `<DetailRow>` component for label/value pairs. `<PriceRow>` for monetary lines.

**Payment section (Bolt-style):**

```tsx
// Individual line
<View style={styles.payRow}>  // flexDirection: row, paddingVertical: 12
  <Text style={styles.payLabel}>Material</Text>   // Inter_500Medium, 16px
  <Text style={styles.payAmount}>€120.00</Text>   // Inter_500Medium, 16px
</View>
<View style={styles.payHairline} />  // 1px, #E5E7EB

// Total line
<View style={styles.payRow}>
  <Text style={styles.payLabel}>Kopā</Text>
  <Text style={styles.payTotalAmount}>€145.00</Text>  // Inter_700Bold, 16px
</View>

// Payment method
<View style={styles.payMethodRow}>  // marginTop: 12
  ...brand icon + label
</View>
```

**"Saņemt čeku" CTA:** shown only when `isTerminal` (COLLECTED / COMPLETED / CANCELLED / DELIVERED). Sticky footer.

---

## Order wizard pattern (`(wizards)/`)

**When to use:** multi-step order creation (material order, skip hire, transport, disposal)

**Rules:**

- Each wizard has its own context file: `lib/order-context.tsx`, `lib/disposal-context.tsx`, `lib/transport-context.tsx`
- Steps are separate screens navigated via `router.push` — not tabs or swipeable pagers
- Step 1 always sets the order type / primary selection
- Final step is always a review + confirm screen before API call
- On success → `router.replace('/(buyer)/orders')` or the new order's tracking screen

**Never build a wizard inside a BottomSheet** if a `(wizards)/` directory already covers that flow.

---

## Order list & card pattern

**Used in:** `(buyer)/orders`, `(buyer)/home`

- List items use `<OrderCard>` or `<JobCard>` — never inline View + Text replicas
- Status badge uses `<StatusPill status={...} />` — never a raw View + Text with colour logic
- Empty state uses `<EmptyState icon={...} title="..." />` — never custom empty views
- Pull-to-refresh via `<RefreshControl>` on the ScrollView — always present on lists

---

## Navigation rules

| Action                  | Pattern                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| Back (can go back)      | `router.canGoBack() ? router.back() : router.replace('/(buyer)/orders')` |
| After terminal action   | `router.replace(...)` — not `push` (remove from stack)                   |
| Open details from list  | `router.push('/(buyer)/<type>/${id}/details')`                           |
| Open tracking from list | `router.push('/(buyer)/<type>/${id}')` (index)                           |
| Open chat               | `router.push('/(shared)/chat/${jobId}')`                                 |
| Open help               | `router.push('/(shared)/help')`                                          |

---

## Loading & empty states

```tsx
// Loading
if (loading)
  return (
    <ScreenContainer bg="#FFFFFF" standalone>
      <SkeletonDetail />
    </ScreenContainer>
  );

// Not found / error
if (!data)
  return (
    <ScreenContainer bg="#FFFFFF" standalone>
      <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Nav atrasts" />
    </ScreenContainer>
  );
```

Never show a full ScreenHeader with back button in loading/empty states on details screens — use white bg + skeleton only.

---

## What not to do

- **No `width: '100%'`** on flex row children that share space with sibling elements
- **No hardcoded hex colours** — use token classes (`bg-primary`, `text-text-muted`) or the named StyleSheet constants (`ORANGE`)
- **No `console.log`** — remove all debug logs before committing
- **No `StyleSheet.create`** for layout that can be expressed in NativeWind classes
- **No duplicate BottomSheets** for flows that have a dedicated wizard screen
- **No `MessageCircle` icon linking to details** — it always goes to help
