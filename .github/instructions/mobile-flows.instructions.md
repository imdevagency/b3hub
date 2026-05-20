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

**When to use:** multi-step order creation (material order, transport, disposal)

### Material order — 7-step Schüttflix-modelled flow (CANONICAL)

The material order wizard (`(wizards)/material-order.tsx`) follows a 7-step flow for delivery, 5-step for pickup, modelled on Schüttflix best practice.

**Delivery flow (7 steps):**

```
Step 1 — order-type  : Delivery or Pickup? (full-screen card selection)
Step 2 — product     : Material category (visual 2-col grid) + fraction (bottom sheet)
Step 3 — quantity    : Tab: "Veselas automašīnas" (BY_LOAD vehicle grid) | "Ievadīt daudzumu" (BY_WEIGHT/BY_VOLUME stepper)
Step 4 — address     : Delivery address + site access restrictions (max truck class chips)
Step 5 — unload      : Precise unload spot (optional: map pin + site photo + access notes)
Step 6 — when        : Delivery date (calendar) + time window (Any / AM / PM)
Step 7 — offers      : Supplier comparison (top offers, pick one) → contact → submit
```

**Pickup flow (5 steps):**

```
Step 1 — order-type  : Delivery or Pickup? → user picks Pickup
Step 2 — product     : Material category + fraction
Step 3 — quantity    : Amount selection
Step 4 — field       : Pickup point + slot selection
Step 5 — offers      : Confirm + submit
```

**Step components** (all in `components/wizard/material/`):
| Step key | Component | Description |
|--------------|---------------------|--------------------------------------------------|
| `order-type` | `OrderTypeStep` | Two-card selection, auto-advances on tap |
| `product` | `ProductStep` | 2-col category grid + fraction bottom sheet |
| `quantity` | `QuantityStep` | Tab: vehicle grid OR manual stepper |
| `address` | inline in wizard | AddressField + truck access restriction chips |
| `unload` | `UnloadSpotStep` | Optional: map pin + photo + notes; skip allowed |
| `when` | `WhenStep` | Calendar (single date) + AM/PM/Any window |
| `offers` | `OffersStep` | Supplier cards + contact form + submit |
| `field` | `FieldPickerStep` | Pickup-only: field + slot selection |

### Other wizards step maps

| Wizard        | Step 1                 | Step 2        | Step 3     | Step 4         |
| ------------- | ---------------------- | ------------- | ---------- | -------------- |
| **transport** | Pickup+Dropoff address | Vehicle+cargo | Date+route | Contact+submit |
| **disposal**  | Waste type             | Location      | Volume     | Date+confirm   |

### Rules

- Each wizard has its own context file: `lib/order-context.tsx`, `lib/disposal-context.tsx`, `lib/transport-context.tsx`
- Steps are separate screens rendered inside `WizardLayout` — **not** tabs, swipeable pagers, or BottomSheets
- The `WizardLayout` shell (thin progress bar + large bold left-aligned title + pill CTA) **must** be used for all steps — never build a custom shell
- **Never render a wizard step title locally inside the screen component.** The `WizardLayout` shell already provides the large left-aligned h1 title. Local titles duplicate the header (e.g., two "Kur piegādāt?" or "Piegādes vieta" texts). Render only section subtitles or form elements inside the step.
- Step 1 always sets the order type / primary selection — must never ask for address first
- The "compare offers / pick a supplier" step **always comes last** — after date is set
- Optional steps (e.g. `unload`) must always have a visible "Izlaist" (skip) action — never block progression
- On success → `router.replace('/(buyer)/orders')` or the new order's tracking screen
- Keep wizard steps focused. Merge only if two decisions are trivially related. Never merge to hit an arbitrary step count — the material order has 7 steps for good UX reasons.

### WizardLayout chrome

`components/wizard/WizardLayout.tsx` provides the full shell. Always pass:

```tsx
<WizardLayout
  title="Kur piegādāt?" // large left-aligned step title
  step={2} // 1-based
  totalSteps={4} // drives progress bar fill
  onBack={handleBack}
  ctaLabel="Turpināt"
  onCTA={handleNext}
  ctaDisabled={!isValid}
  stepKey={step} // triggers slide-in animation on step change
>
  {/* step content */}
</WizardLayout>
```

Progress bar fills proportionally from primary colour. CTA button is full-width pill, disabled = muted gray.

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
