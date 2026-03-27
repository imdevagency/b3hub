---
applyTo: 'apps/mobile/**'
---

# Mobile Styling Rules — NativeWind Safe Usage

NativeWind v4 compiles Tailwind classes at **build time**. Classes that are only scanned correctly exist in the Tailwind output CSS; classes that the scanner misses silently produce no styles at runtime. The rules below guarantee styles always apply.

---

## The core problem: when className silently breaks

NativeWind **will reliably apply** standard Tailwind classes that have fixed names (`flex-1`, `flex-row`, `bg-white`, `p-4`, `rounded-xl`, etc.).

NativeWind **will silently fail** in two situations:

1. **Arbitrary values** — `text-[16px]`, `leading-[22px]`, `gap-[6px]`, `text-[#1a2b3c]`. These are scanned at build time and may not appear in the cached output if the cache is stale.
2. **Font-weight + custom Text component conflict** — The `Text` from `@/components/ui/text` injects `font-sans` (→ `Inter_400Regular`) via CVA defaults. Adding `font-bold` via `className` tries to merge two different `fontFamily` values. `tailwind-merge` does not resolve this conflict — both end up in the className, whichever NativeWind applies last wins, often ignoring your override.

---

## Rule 1 — Never use arbitrary values in className

```tsx
// ✗ WRONG — arbitrary, may silently fail
<Text className="text-[16px] leading-[22px] tracking-[-0.4px]">Label</Text>

// ✓ CORRECT — move pixel-precise values to style
<Text style={{ fontSize: 16, lineHeight: 22, letterSpacing: -0.4 }}>Label</Text>
```

The same rule applies to arbitrary colours, spacing, and radius:

```tsx
// ✗ WRONG
<View className="bg-[#f3f4f6] gap-[12px] rounded-[10px]" />

// ✓ CORRECT — use a token class or style prop
<View style={{ backgroundColor: '#f3f4f6', gap: 12, borderRadius: 10 }} />
// or
<View className="bg-muted gap-md rounded-md" />   // ← prefer token class when available
```

---

## Rule 2 — Never mix the custom Text component with font-weight className

The `Text` from `@/components/ui/text` always has `fontFamily: 'Inter_400Regular'` as a base. Adding `font-bold` via className creates a silent conflict.

```tsx
// ✗ WRONG — CVA base + className font override → unpredictable
import { Text } from '@/components/ui/text';
<Text className="text-[28px] font-extrabold text-gray-900">Heading</Text>;

// ✓ CORRECT option A — use react-native Text with explicit style
import { Text } from 'react-native';
<Text
  style={{ fontSize: 28, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: '#111827' }}
>
  Heading
</Text>;

// ✓ CORRECT option B — use the custom Text for body copy with standard sizes only
import { Text } from '@/components/ui/text';
<Text variant="muted" size="sm">
  Caption text
</Text>;
```

**Use the custom `Text` component for body copy with its built-in variant/size system.**
**Use react-native `Text` with explicit `style` when you need custom font sizes or weights.**

---

## Rule 3 — Font weight always requires both fontFamily and fontWeight

React Native on iOS cannot synthesize bold/semibold from a custom font. You must specify the exact loaded face name.

```tsx
// ✗ WRONG — fontWeight alone doesn't work with Inter on iOS
<Text style={{ fontWeight: '700' }}>Bold</Text>

// ✓ CORRECT — always pair fontFamily with fontWeight
<Text style={{ fontFamily: 'Inter_700Bold', fontWeight: '700' }}>Bold</Text>
```

### Inter font face reference

| Visual weight   | `fontFamily`         | `fontWeight` |
| --------------- | -------------------- | ------------ |
| Light (300)     | `Inter_300Light`     | `'300'`      |
| Regular (400)   | `Inter_400Regular`   | `'400'`      |
| Medium (500)    | `Inter_500Medium`    | `'500'`      |
| Semibold (600)  | `Inter_600SemiBold`  | `'600'`      |
| Bold (700)      | `Inter_700Bold`      | `'700'`      |
| Extrabold (800) | `Inter_800ExtraBold` | `'800'`      |

---

## Rule 4 — What is safe to put in className

These standard Tailwind classes are reliably scanned and cached:

| Category                  | Safe className examples                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Flex layout               | `flex-1`, `flex-row`, `flex-col`, `items-center`, `justify-between`                         |
| Position                  | `relative`, `absolute`, `overflow-hidden`                                                   |
| Token colours             | `bg-card`, `bg-screen`, `bg-muted`, `text-text-primary`, `text-text-muted`, `border-border` |
| Standard Tailwind colours | `bg-white`, `bg-gray-100`, `text-black`, `text-gray-500`, `border-gray-200`                 |
| Token spacing             | `p-xs`, `p-sm`, `p-md`, `p-base`, `p-lg`, `p-xl`, `gap-xs` … `gap-xl`                       |
| Standard spacing          | `p-4`, `m-2`, `px-6`, `py-3` (multiples of 4 = safe)                                        |
| Token radius              | `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`                      |
| Standard radius           | `rounded`, `rounded-lg`, `rounded-2xl`                                                      |
| Font variants             | `font-sans` (body default via custom Text only)                                             |
| Opacity                   | `opacity-50`, `opacity-0`                                                                   |
| Show/hide                 | `hidden`                                                                                    |

---

## Rule 5 — Always use style for these properties

Never use className for these — always explicit `style` prop:

| Property                            | Reason                                                             |
| ----------------------------------- | ------------------------------------------------------------------ |
| `fontSize`                          | Arbitrary values silently fail                                     |
| `fontFamily`                        | See Rule 2 & 3                                                     |
| `fontWeight`                        | See Rule 3                                                         |
| `lineHeight`                        | Arbitrary values silently fail                                     |
| `letterSpacing`                     | Arbitrary values silently fail                                     |
| `shadowColor/Offset/Opacity/Radius` | Not supported by NativeWind v4                                     |
| `elevation`                         | Android-only, not a Tailwind concept                               |
| `gap` with non-token pixel values   | Use `gap-md` (12) etc., or `style={{ gap: N }}`                    |
| Dynamic values (interpolated)       | `className` cannot be dynamic — computed styles must be in `style` |

### Shadow pattern (iOS + Android)

```tsx
// ✓ Always write shadows in style, never className
style={{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
}}
```

---

## Rule 6 — No dynamic className construction

NativeWind's Tailwind scanner runs at build time, so dynamically assembled class names will never be in the output.

```tsx
// ✗ WRONG — dynamic class construction, scanner can't find it
const color = isActive ? 'blue' : 'gray';
<View className={`bg-${color}-500`} />

// ✓ CORRECT — full class name always visible to scanner
<View className={isActive ? 'bg-blue-500' : 'bg-gray-100'} />

// ✓ ALSO CORRECT — use style for dynamic values
<View style={{ backgroundColor: isActive ? '#3b82f6' : '#f3f4f6' }} />
```

---

## Rule 7 — gap in TouchableOpacity/View requires style

NativeWind's `gap-*` on `View` works, but `gap` on `TouchableOpacity` can fail. Always use `style={{ gap }}` on Touchable\* components:

```tsx
// ✗ Unreliable on TouchableOpacity
<TouchableOpacity className="flex-row gap-4">

// ✓ Safe
<TouchableOpacity style={{ flexDirection: 'row', gap: 16 }}>
```

---

## Quick-decision guide

```
Does this value come from a Tailwind token or a fixed Tailwind scale?
    YES → className is fine (e.g. p-4, bg-white, rounded-lg, flex-1)
     NO → use style prop

Is this fontSize, fontWeight, fontFamily, lineHeight, or letterSpacing?
    YES → always use style

Is this value dynamic (computed at runtime)?
    YES → always use style

Am I adding font-weight to the custom Text from @/components/ui/text?
    YES → don't. Switch to react-native Text + explicit style
```

---

## Why big apps (Uber, Shopify, etc.) avoid this class of problem

Large React Native apps – Uber Rider, Shopify POS, Discord – converge on one of three patterns that eliminate build-cache dependency entirely:

1. **Design-token + StyleSheet.create** (Uber's internal approach, Shopify's `@shopify/restyle`): All styling is authored as typed objects against a token map, compiled once at JS bundle time. No separate CSS build step. Zero silent failures.

2. **StyleSheet + theme hook**: `const styles = useTheme()` returns pre-typed style objects. No class strings ever touch the component.

3. **Tamagui**: compile-time CSS-in-JS that generates atomic styles without a separate Tailwind scan; arbitrary values always work.

**This codebase uses NativeWind**, which is fine for layout and colours from the standard scale. Apply the rules above to stay in the "reliably scanned" zone and use explicit `style` for everything that needs pixel-precise or font-related control.
