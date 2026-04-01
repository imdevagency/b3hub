---
applyTo: 'apps/mobile/**'
---

# Mobile — Bottom Tab Architecture

> Rules for designing, editing, or adding bottom tab bars across all three role layouts.
> Read this before touching any `_layout.tsx` inside `(buyer)/`, `(seller)/`, or `(driver)/`.

---

## Industry UX standards (applied here)

| Rule                                                     | Rationale                                                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **3–5 tabs maximum**                                     | Human thumb can reliably reach 5 targets. More than 5 → move to sidebar / "More" overflow                                                      |
| **Tab = destination, not action**                        | Tabs switch between top-level sections. Place CTAs (New Order, Accept Job) inside screens, not in the tab bar                                  |
| **Always-visible, never hide on scroll**                 | Tab bar must stay fixed. Only hide it on full-screen immersive views (active job map) — and always restore it on back                          |
| **Active state is unambiguous**                          | Icon + label both change color. Never rely on icon shape alone (accessibility)                                                                 |
| **Badge = async count only**                             | Badges show unread/pending counts (integers). Never use badges for decorative dots or static alerts                                            |
| **First tab = most-used screen**                         | Users land here on every app open. It must be the highest-frequency action for that role                                                       |
| **Last tab = Profile/Account**                           | Universal iOS/Android convention. Users always look there for settings and identity                                                            |
| **Labels are short**                                     | 1–2 words max, ≤10 characters. Truncation on small screens destroys UX                                                                         |
| **Icons are filled when active, outlined when inactive** | Filled icon = "you are here". Lucide icons used here: active = use filled variant or increase stroke fill                                      |
| **Haptic feedback on tab press**                         | Already wired in `AnimatedTabBar`. Never remove haptics call                                                                                   |
| **No nested tab bars**                                   | A screen inside a tab must not introduce its own horizontal tabs at the bottom. Use top segment controls or in-page filters instead            |
| **Back gesture does not change active tab**              | Deep navigation within a tab (Home → order detail → job detail) uses the stack navigator inside the tab. Back collapses the stack, not the tab |

---

## Current tab configurations

### Buyer — `(buyer)/_layout.tsx`

| #   | Tab name              | Route       | Icon            | Badge         |
| --- | --------------------- | ----------- | --------------- | ------------- |
| 1   | Sākums (Home)         | `home`      | `Home`          | —             |
| 2   | Aktivitāte (Activity) | `orders`    | `ClipboardList` | `unreadCount` |
| 3   | Pasūtīt (Order)       | `new-order` | `ShoppingCart`  | —             |
| 4   | Profils (Profile)     | `profile`   | `User`          | —             |

---

### Seller — `(seller)/_layout.tsx`

| #   | Tab name             | Route      | Icon         | Badge |
| --- | -------------------- | ---------- | ------------ | ----- |
| 1   | Sākums (Home)        | `home`     | `Home`       | —     |
| 2   | Ienākošie (Incoming) | `incoming` | `Inbox`      | —     |
| 3   | Katalogs (Catalog)   | `catalog`  | `LayoutGrid` | —     |
| 4   | Ienākumi (Earnings)  | `earnings` | `Wallet`     | —     |
| 5   | Profils (Profile)    | `profile`  | `User`       | —     |

---

### Driver — `(driver)/_layout.tsx`

| #   | Tab name            | Route      | Icon            | Badge |
| --- | ------------------- | ---------- | --------------- | ----- |
| 1   | Sākums (Home)       | `home`     | `Home`          | —     |
| 2   | Darbi (Jobs)        | `jobs`     | `ClipboardList` | —     |
| 3   | Aktīvs (Active)     | `active`   | `Map`           | —     |
| 4   | Ienākumi (Earnings) | `earnings` | `Wallet`        | —     |
| 5   | Profils (Profile)   | `profile`  | `User`          | —     |

**Note:** Active job tab hides the tab bar entirely (`renderTabBar` returns `null` on `/(driver)/active`). This is intentional — full-screen map mode. Skips, Vehicles, and Schedule are in the sidebar.

---

## Hidden routes pattern

Any screen that is navigable within a tab group but should **not** appear as a tab must be declared with `href: null`:

```tsx
<Tabs.Screen name="order/[id]" options={{ href: null }} />
```

Rules:

- All dynamic routes (`[id]`, `[orderId]`) must be `href: null`
- Detail screens, sub-flows (rfq, skip-order, transport-job, delivery-proof) must be `href: null`
- Never add a dynamic route as a visible tab

---

## Full-screen / immersive screens

Some screens must hide the tab bar entirely (e.g. live map, delivery proof capture). Implement via the `renderTabBar` prop:

```tsx
const renderTabBar = useCallback(
  (props: BottomTabBarProps) => {
    if (isFullScreenRoute(pathname)) return null; // hide tab bar
    return <AnimatedTabBar {...props} />;
  },
  [pathname],
);
```

Screens that currently hide the tab bar:

- `/(driver)/active` — live job map

When a screen hides the tab bar, it **must** provide its own back navigation (e.g. `ScreenHeader` with back button, or a floating close button).

---

## AnimatedTabBar rules

Component: `components/ui/AnimatedTabBar.tsx`

- Uses React Native's built-in `Animated` API — **never switch to Reanimated** in this component (causes JSI HostFunction crashes in Expo Go)
- Active tint: `#111827` (default), override via `activeTint` prop
- Inactive tint: `#9ca3af` (default), override via `inactiveTint`
- Tab height: `56px` + bottom safe area inset
- Haptic feedback fires on every press via `haptics` util
- Badges: integer only, rendered as red pill above icon. Pass `tabBarBadge` in screen options

**Never replace AnimatedTabBar with the default Expo/React Navigation tab bar.** The custom component is required for animation consistency and haptics.

---

## Adding a new tab — checklist

1. The screen route file must exist under the relevant role group (`(buyer)/`, `(seller)/`, `(driver)/`)
2. Add `<Tabs.Screen name="..." options={{ title: '...', tabBarIcon: ... }} />` in the correct position (alphabetically by priority, Profile always last)
3. Add the Latvian label to `lib/translations.ts` under `tabs` and `nav`
4. If the tab needs a notification badge, wire it to the appropriate API count endpoint via a custom hook in `lib/`
5. Ensure total visible tabs ≤ 5 — if adding one pushes over 5, move the lowest-priority existing tab to the sidebar
6. Add detail/nested routes as `href: null` screens in the same `<Tabs>` block

---

## What belongs in tabs vs sidebar

| Tab (always visible)                       | Sidebar (hamburger overflow)      |
| ------------------------------------------ | --------------------------------- |
| Daily-use primary destinations             | Infrequent or secondary features  |
| Home / Dashboard                           | Settings                          |
| Active work queue (Orders, Jobs, Incoming) | Documents, Certificates, Invoices |
| Primary catalog or map                     | Projects, Framework Contracts     |
| Earnings / Financials                      | Team management                   |
| Profile / Account                          | Help, T&Cs, Logout                |

---

## Badge wiring pattern

```tsx
// In _layout.tsx
const unreadCount = useUnreadCount(); // lib/use-unread-count.ts

<Tabs.Screen
  name="orders"
  options={{
    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
  }}
/>;
```

- Return `undefined` (not `0`) when count is zero — `0` renders an empty badge pill
- Cap display at `99+` for counts > 99 — handled inside `AnimatedTabBar`
- Only wire badges to real-time or polled server counts, never to local state alone
