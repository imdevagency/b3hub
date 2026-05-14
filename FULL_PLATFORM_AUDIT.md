# Bilt Full Platform UI/UX Code Audit

> **Scope**: Mobile (Expo/React Native), Web (Next.js 14), Backend patterns  
> **Methodology**: IA review → Ownership analysis → Redundancy audit → User journey analysis → Heuristic evaluation  
> **Coverage**: 84 mobile screens + all web dashboards + cross-cutting pattern searches  
> **Prior session fixes already applied**: C1–C2, H1–H6, M1–M4, R1–R8 ✅

---

## Executive Summary

The platform is architecturally sound and largely complete. Core patterns (ScreenContainer, ScreenHeader, InfoSection/DetailRow, StatusPill, EmptyState, lib/status, lib/format, useLogoutConfirm) are well-established and consistently applied across buyer and seller screens. The main remaining issues are:

- **4 outright bugs** (gate logout, material wizard auth gate, recycler job card nav, RoleSheet RECYCLER gap)
- **Duplication of view-layer components** (TileGrid/ListRow in all 4 More screens — ~80-100 duplicated lines each)
- **Mixed header component strategy** in driver screens (TopBar vs ScreenHeader — 2 screens inconsistent)
- **Inline status maps** still present in 5 screen files despite lib/status.ts existing
- **Inline date formatters** in 15+ screen files despite lib/format.ts existing
- **Invoices surface fragmentation**: standalone `invoices.tsx` + documents hub `InvoicesTab` — two UIs for same data, one dead
- **Recycler role** has 3 pre-existing TypeScript errors, raw empty states, missing RoleSheet case
- **Messages access inconsistency** across roles (visible tab for driver; buried in More for buyer/seller)

---

## Section A — Information Architecture

### A1 · Tab bar structure inconsistency — Messages (**MEDIUM**)

| Role     | Messages access                                  |
| -------- | ------------------------------------------------ |
| Buyer    | Hidden tab, accessible only via More screen tile |
| Seller   | Hidden tab, accessible only via More screen tile |
| Driver   | **Visible tab with unread badge**                |
| Recycler | Accessible only via More screen row              |

Driver has Messages as a 4th visible tab (after Home, Schedule, Earnings) with a `chatUnreadCount` badge. Buyer and seller bury it inside the More screen grid. No product justification for this asymmetry — chat is equally critical for order coordination across all roles.

**Recommendation**: Expose Messages as a visible tab for buyer and seller (replace one of the less-used tabs, or expand to 5 tabs), or demote driver Messages to More. Either direction is acceptable; the current hybrid is confusing.

---

### A2 · Invoices surface fragmentation (**HIGH** — dead screen risk)

Invoices appear in **two separate places** for buyers:

1. `app/(buyer)/(account)/invoices.tsx` — standalone screen with full invoice detail sheet
2. `app/(buyer)/(account)/documents.tsx` → internal `InvoicesTab` component — same data rendered differently inside the Documents hub (3-tab: Dokumenti | Rēķini | Sertifikāti)

The More screen navigates to `documents.tsx`, not `invoices.tsx`. The `invoices.tsx` file is registered as a hidden route but **no active navigation path leads to it from the current More screen** — it was apparently superseded by the documents hub's tab, but the file was never deleted.

**Fix**: Delete `app/(buyer)/(account)/invoices.tsx`. The Documents hub's `InvoicesTab` is the live UI. Update any remaining `router.push('/(buyer)/(account)/invoices')` references.

---

### A3 · Driver Home vs Jobs — overlapping content (**LOW**)

`(driver)/home.tsx` shows available jobs and upcoming jobs in a bottom panel. `(driver)/jobs.tsx` is a full-featured job browser (FlatList, filter sheet, map view, saved searches). Both fetch and display `ApiTransportJob` data.

Home is the correct entry point for "what's happening now". Jobs is for discovery/browsing. The issue is that Home duplicates available-jobs rendering inline rather than delegating cleanly to Jobs. The bottom panel on Home doubles as a reduced jobs list — creating two code paths for the same concern.

**Recommendation**: Home should show only the most urgent single action (active job, or a count "N jobs available near you") and tap-navigate to Jobs for discovery. Remove inline job list from Home bottom panel.

---

### A4 · Profile access path varies by role (**LOW**)

- **Buyer**: Avatar initials button in `TopBar` → profile push
- **Seller/Driver/Recycler**: More screen identity card → profile push

The underlying screen is the same (`(buyer)/profile.tsx`, re-exported from all other roles). The access divergence is minor and somewhat intentional (buyer TopBar keeps profile one tap away), but could be standardised.

---

### A5 · Settings screen duplicates logout entry point (**INFO**)

`(shared)/settings.tsx` has a "Iziet" (logout) button. All More screens also have logout. This gives users logout access in two places per role. Intentional discoverability — acceptable as-is.

---

## Section B — Bugs / Missing Behaviour

### B1 · Gate logout skips confirmation hook (**BUG**)

**File**: [app/(gate)/fields.tsx](<apps/mobile/app/(gate)/fields.tsx#L53>)

`(gate)/fields.tsx` calls `logout()` directly without using `useLogoutConfirm`. All other logout paths (buyer, seller, driver, recycler More + Settings) use the confirmation hook. Gate operators can accidentally log out with no confirmation dialog.

```ts
// Current — line 53
const handleLogout = () => {
  logout();
};

// Fix
const handleLogout = useLogoutConfirm();
```

---

### B2 · Material order wizard missing WizardAuthGate (**BUG**)

**File**: [app/(wizards)/material-order.tsx](<apps/mobile/app/(wizards)/material-order.tsx>)

All three other wizards (skip-hire, transport, disposal) render `<WizardAuthGate>` before submit — allowing guest users to complete steps and authenticate at the last step. `material-order.tsx` has no `WizardAuthGate`. Unauthenticated users hitting the offers step receive a raw API auth error, not a smooth sign-in prompt.

**Fix**: Add `<WizardAuthGate>` render on the `offers` step, matching the pattern in `disposal/index.tsx` line 904 and `transport/index.tsx` line 1010.

---

### B3 · Recycler incoming JobCard has no onPress (**BUG**)

**File**: [app/(recycler)/incoming.tsx](<apps/mobile/app/(recycler)/incoming.tsx>)

`JobCard` renders a `<TouchableOpacity>` with `activeOpacity={0.85}` but no `onPress` handler. Tapping a job does nothing. There is no detail screen in the recycler group to navigate to — either the onPress should navigate somewhere (even a BottomSheet with job details) or the TouchableOpacity should be a plain View.

---

### B4 · RoleSheet missing RECYCLER mode (**BUG**)

**File**: [components/ui/RoleSheet.tsx](apps/mobile/components/ui/RoleSheet.tsx)

`ROLE_CFG` in RoleSheet does not have a `RECYCLER` case. If a multi-role user's active mode is `RECYCLER` and they open the role switcher, the sheet will either crash or render nothing for the current role. All other modes (BUYER, SUPPLIER, CARRIER, CONSTRUCTION) are handled.

---

## Section C — Code Redundancy

### C1 · TileGrid + ListRow duplicated across 4 More screens (**HIGH**)

Identical component definitions in:

- `app/(buyer)/more.tsx` — TileGrid + ListRow + full StyleSheet
- `app/(seller)/more.tsx` — TileGrid + ListRow + full StyleSheet (confirmed same implementation)
- `app/(driver)/more.tsx` — TileGrid + ListRow + full StyleSheet (minor variant)
- `app/(recycler)/more.tsx` — ListRow only (no TileGrid, simpler screen)

Each file defines its own local `TileGrid` function, `ListRow` function, `TileItem` type, and ~120-line StyleSheet. Approximately 80–100 lines of identical code repeated per file.

**Fix**: Extract to `components/ui/MoreTileGrid.tsx` and `components/ui/MoreListRow.tsx`. Update all four More screens to import these.

---

### C2 · Inline status maps in 5 screen files (**MEDIUM**)

Despite `lib/status.ts` providing centralised status formatters, these files still define local maps:

| File                                 | Local map                                                     | Correct replacement                        |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------ |
| `app/(buyer)/home.tsx`               | `STATUS_LABEL`, `STATUS_DOT`                                  | `getOrderStatus()`                         |
| `app/(buyer)/order/[id]/index.tsx`   | `JOB_STATUS_LABEL`, `ORDER_STATUS_PILL`, `JOB_STATUS_TO_STEP` | `getJobStatus()`, `getOrderStatus()`       |
| `app/(seller)/order/[id].tsx`        | `getStatusColors()`, `formatStatus()`                         | `getSellerOrderStatus()`                   |
| `app/(buyer)/orders.tsx`             | `GUEST_STATUS_LABEL`                                          | Add `GUEST_ORDER_STATUS_MAP` to lib/status |
| `app/(buyer)/(account)/invoices.tsx` | `STATUS_META` (InvoiceStatus)                                 | Add `INVOICE_STATUS_MAP` to lib/status     |

---

### C3 · Inline date formatters — lib/format adoption incomplete (**MEDIUM**)

`lib/format.ts` exports `formatDate`, `formatDateTime`, `formatDateShort`, `formatDateNumeric`, `formatDateMedium`. Only 15 screen files import from it. 20+ other files use inline `toLocaleDateString` calls or local `fmtDate` wrappers.

Key offenders:

- `app/(buyer)/order/[id]/details.tsx` — 4 inline `toLocaleDateString` calls
- `app/(buyer)/(account)/documents.tsx` — 3 different inline date functions
- `app/(seller)/incoming.tsx` — inline `toLocaleDateString`
- `app/(seller)/documents.tsx` — inline `toLocaleDateString`
- `app/(seller)/quotes.tsx` — inline `toLocaleDateString`
- `app/(recycler)/incoming.tsx` — inline `toLocaleDateString` with custom options
- `app/(recycler)/records.tsx` — inline `toLocaleDateString`
- `app/(shared)/notifications.tsx` — inline date formatter function

**Fix**: Audit and add missing format variants (e.g. `formatDateShort2` for `dd.mm` format), then replace all inline calls.

---

### C4 · Three maps missing from lib/status.ts

Candidates to add that are currently inlined in screens:

```ts
// Add to lib/status.ts:
INVOICE_STATUS_MAP: Record<InvoiceStatus, StatusMeta>;
GUEST_ORDER_STATUS_MAP: Record<string, string>;
VEHICLE_TYPE_LABELS: Record<VehicleType, string>; // currently in vehicles.tsx
```

---

## Section D — Component Quality

### D1 · Driver screens: mixed header component (**LOW**)

Driver-group screens use **two different header components** with no documented rule:

| Screen              | Header used                  |
| ------------------- | ---------------------------- |
| `schedule.tsx`      | `TopBar` (transparent)       |
| `earnings.tsx`      | `TopBar` (transparent)       |
| `vehicles.tsx`      | `ScreenHeader`               |
| `jobs.tsx`          | `ScreenHeader`               |
| `documents.tsx`     | `ScreenHeader`               |
| `job-stat/[id].tsx` | `ScreenHeader`               |
| `more.tsx`          | `ScreenHeader`               |
| `home.tsx`          | Custom via `useHeaderConfig` |
| `active.tsx`        | Full-screen map (no header)  |

Buyer and seller screens are fully consistent (all use `ScreenHeader`). The driver inconsistency is unintentional — `schedule.tsx` and `earnings.tsx` use `TopBar` likely because they were built at an earlier stage.

**Recommended rule**: `TopBar` = tab root screens that are also "home" for the tab (driver home). `ScreenHeader` = all list/detail/secondary screens. Apply to schedule and earnings.

---

### D2 · Recycler role — multiple quality gaps (**MEDIUM**)

1. **TypeScript errors**: `home.tsx`, `incoming.tsx`, `records.tsx` have pre-existing TS errors from unknown `title` prop on `LayoutHeaderConfig` and wrong `EmptyState` prop signature
2. **Missing `<EmptyState>`**: `home.tsx` uses a raw `<View style={ls.emptyBox}><Text>Nav aktīvu piegāžu</Text></View>` instead of the standard `<EmptyState>` component
3. **Missing RECYCLER in RoleSheet**: Bug B4 above
4. **Sparse More screen**: Recycler More has no TileGrid — only ListRow items. Missing Earnings, Documents, Messages tiles that parallel other roles
5. **No job detail screen**: Incoming jobs have no navigation target (bug B3)

---

### D3 · Buyer profile TypeScript errors (pre-existing)

**File**: [app/(buyer)/profile.tsx](<apps/mobile/app/(buyer)/profile.tsx>)

Two pre-existing TS errors:

1. `ROLE_THEME[mode]` — `mode` typed as `string` but `ROLE_THEME` keyed on `'BUYER' | 'SUPPLIER' | 'CARRIER'`
2. Orphaned `router` reference (variable removed in a refactor but reference remains)

---

### D4 · Seller billing-settings TypeScript errors (pre-existing)

**File**: [app/(seller)/billing-settings.tsx](<apps/mobile/app/(seller)/billing-settings.tsx>)

3 TS errors: calls `api.company` and references `session` which don't exist on the api object. Screen appears to be a stub with placeholder code that was never completed.

---

## Section E — User Journey Analysis

### E1 · Buyer home: active order not sorted by urgency (**LOW**)

In `(buyer)/home.tsx`, the hero "active order" card is determined by `orders.find(o => ACTIVE_STATUSES.has(o.status))` — first match in array order. A buyer with multiple active orders could see a stale PENDING order rather than one currently being delivered (DISPATCHED).

**Fix**: Sort candidates by status priority before `.find()`:

```ts
const PRIORITY = { DISPATCHED: 0, CONFIRMED: 1, PENDING: 2 };
const sorted = orders
  .filter((o) => ACTIVE_STATUSES.has(o.status))
  .sort((a, b) => (PRIORITY[a.status] ?? 99) - (PRIORITY[b.status] ?? 99));
const mat = sorted[0];
```

---

### E2 · Wizard draft TTL inconsistency (**LOW**)

| Wizard         | Draft TTL                             |
| -------------- | ------------------------------------- |
| material-order | None — persists indefinitely          |
| disposal       | 7 days (`DRAFT_TTL_MS`)               |
| transport      | Not confirmed — AsyncStorage key used |
| skip-hire      | Not confirmed                         |

Material order draft has no TTL. A buyer could return weeks later and be pre-filled with a stale draft, causing confusion.

**Fix**: Add `DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000` and check on load in `material-order.tsx`, matching the pattern in `disposal/index.tsx`.

---

### E3 · Driver active screen: no redirect when no active job (**LOW**)

`(driver)/active.tsx` is a full-screen experience. The driver tab bar's "Home" tab shows a dynamic icon — truck icon when `hasActiveJob`, standard home icon otherwise. But if a driver taps the tab when no job is active, the layout routes to `active.tsx` showing an EmptyState. There is no auto-redirect to `jobs.tsx` (the discovery screen). The driver is left at a dead end.

**Fix**: In `active.tsx`, if `!hasActiveJob` after loading, `router.replace('/(driver)/jobs')`.

---

## Section F — Web Portal

### F1 · Admin sidebar scope switching is well-implemented ✅

The 4-tab scope switcher (Grupa | APP | Recycle | Būve) in `admin-sidebar.tsx` auto-detects `activeScope` from pathname. Badge counts on APP scope (triage alerts, pending applications, pending guest orders) refresh every 30s. `B3HUB_NAV`, `RECYCLING_NAV`, `CONSTRUCTION_NAV`, `GROUP_NAV` are well-separated. No issues found.

### F2 · AppSidebar covers 5 modes correctly ✅

`app-sidebar.tsx` ROLE_NAV covers BUYER, SUPPLIER, CARRIER, CONSTRUCTION, RECYCLER with distinct nav trees. Mode switching via `useMode()` is reactive. Badge counts (notifications, open RFQs, active jobs, disputes, pending applications, pending seller orders) are fetched and displayed correctly.

### F3 · Platform group has pages for desktop-only flows (**INFO**)

Some platform pages (`/dashboard/analytics`, `/dashboard/projects`, `/dashboard/construction`) are accessed from mobile via `Linking.openURL` (external browser). This is an intentional mobile-light / web-first decision for complex views. No action needed.

### F4 · Web recycling and construction scopes map to dedicated admin tabs ✅

`/dashboard/b3-recycling` and `/dashboard/b3-construction` are fully separate nav trees in the admin sidebar, not mixed into the main APP scope. Clean separation of the three BUs.

---

## Section G — Prioritised Fix List

### 🔴 Priority 1 — Bugs (do now)

| ID  | Issue                                  | File                           | Effort |
| --- | -------------------------------------- | ------------------------------ | ------ |
| B1  | Gate logout skips confirmation         | `(gate)/fields.tsx`            | XS     |
| B2  | Material wizard missing WizardAuthGate | `(wizards)/material-order.tsx` | S      |
| B3  | Recycler incoming JobCard no onPress   | `(recycler)/incoming.tsx`      | S      |
| B4  | RoleSheet missing RECYCLER mode        | `components/ui/RoleSheet.tsx`  | S      |

### 🟠 Priority 2 — IA / UX issues

| ID  | Issue                                                 | Effort |
| --- | ----------------------------------------------------- | ------ |
| A2  | Delete dead `invoices.tsx`; Documents hub is live UI  | S      |
| D2  | Recycler TS errors + missing EmptyState + sparse More | M      |
| E3  | Driver active screen: redirect when no job            | S      |
| E1  | Buyer home: sort active orders by urgency             | S      |

### 🟡 Priority 3 — Code quality / redundancy

| ID  | Issue                                                                | Effort |
| --- | -------------------------------------------------------------------- | ------ |
| C1  | Extract TileGrid/ListRow to shared components                        | M      |
| C2  | Remove inline status maps (5 files)                                  | M      |
| C3  | Replace inline date formatters (15+ files)                           | L      |
| C4  | Add missing maps to lib/status.ts                                    | S      |
| D1  | Driver header: replace TopBar with ScreenHeader in schedule/earnings | XS     |
| D3  | Fix buyer profile TS errors                                          | S      |
| D4  | Fix seller billing-settings (stub completion or placeholder UI)      | M      |
| E2  | Standardise wizard draft TTL                                         | S      |

### 🔵 Priority 4 — Design consistency (plan, don't rush)

| ID         | Issue                                                          | Effort      |
| ---------- | -------------------------------------------------------------- | ----------- |
| A1         | Align Messages access across roles (tab vs More)               | M           |
| A3         | Driver home: remove inline job list, defer to Jobs screen      | M           |
| StyleSheet | Migrate StyleSheet.create → NativeWind (68 files — do on edit) | L (ongoing) |

---

## Appendix A — lib/status.ts current exports

```ts
ORDER_STATUS_MAP; // OrderStatus → {label, bg, color}
JOB_STATUS_MAP; // TransportJobStatus → {label, bg, color}
FRAMEWORK_CONTRACT_STATUS_MAP;
QUOTE_RESPONSE_STATUS_MAP;
DOCUMENT_STATUS_MAP;
RECYCLER_JOB_STATUS_MAP;
DRIVER_JOB_BUYER_LABELS; // TransportJobStatus → string (buyer-readable)
SELLER_ORDER_STATUS_MAP; // added R3 this session
DISPUTE_STATUS_MAP; // added R3 this session

getOrderStatus(status);
getJobStatus(status);
getSellerOrderStatus(status);
getDisputeStatus(status);
getRecyclerJobStatus(status);
getDocumentStatusLabel(status);
getFrameworkContractStatus(status);
getQuoteResponseStatus(status);
```

Still missing (add as C4):

- `INVOICE_STATUS_MAP` — `InvoiceStatus → {label, bg, color}`
- `GUEST_ORDER_STATUS_MAP` — guest order status → string
- `VEHICLE_TYPE_LABELS` — `VehicleType → string`

---

## Appendix B — Screen header consistency map

| Group      | Screens using ScreenHeader                                                | Screens using TopBar/headerConfig                              |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| (buyer)    | All (catalog, orders, more, profile, all account screens, detail screens) | home (headerConfig)                                            |
| (seller)   | All (incoming, catalog, more, profile, earnings, etc.)                    | home (headerConfig)                                            |
| (driver)   | jobs, documents, vehicles, job-stat, more                                 | home (headerConfig), schedule ⚠️, earnings ⚠️, active (custom) |
| (recycler) | more, incoming, records                                                   | home (headerConfig)                                            |
| (wizards)  | All use WizardLayout (has its own header)                                 | —                                                              |
| (shared)   | All                                                                       | —                                                              |

⚠️ = inconsistent with the ScreenHeader pattern used by all other non-home screens in driver group.

---

_Full platform audit completed. 84 mobile screens + web dashboard reviewed._
