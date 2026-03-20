# Form Input Standardization Guide

## Overview

The `TextInputField` component provides **consistent, accessible form input styling** across the entire mobile app. It replaces ad-hoc input styling with a reusable, well-tested component.

## Key Features

✅ **Consistent Styling**

- Standard border color and radius
- Proper padding with 44px minimum touch target (iOS/Android guideline)
- Clear focus state (border emphasis + color change)

✅ **Clear Error Handling**

- Red error message beneath input
- Error border color applied automatically
- Prevents overlapping error + hint text

✅ **Accessibility First**

- `accessibilityLabel` for screen readers
- `accessibilityHint` for supplementary information
- Proper semantic roles

✅ **Built on Design Tokens**

- All colors/spacing from `lib/theme.ts`
- Single source of truth for visual consistency
- Easy to theme globally

## Migration Path

### Old pattern (one-off styling):

```tsx
const [email, setEmail] = useState('');
const [error, setError] = useState('');

<View>
  <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>Email</Text>
  <TextInput
    style={{
      borderWidth: 1,
      borderColor: error ? '#f87171' : '#e5e7eb',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: '#111827',
      backgroundColor: '#fff',
    }}
    placeholder="you@example.com"
    value={email}
    onChangeText={setEmail}
    onBlur={() => validate()}
  />
  {error && <Text style={{ color: '#ef4444', fontSize: 12 }}>{error}</Text>}
</View>;
```

### New pattern (reusable component):

```tsx
import { TextInputField } from '@/components/ui/TextInputField';

const [email, setEmail] = useState('');
const [error, setError] = useState('');

<TextInputField
  label="Email"
  placeholder="you@example.com"
  value={email}
  onChangeText={setEmail}
  error={error}
  hint="We'll never share your email"
  required
  onBlur={() => validate()}
/>;
```

## Props

```typescript
interface TextInputFieldProps {
  // Input-specific
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | ...
  secureTextEntry?: boolean;
  editable?: boolean;
  multiline?: boolean;
  maxLength?: number;

  // Form field enhancements
  label?: string;              // Label above input
  error?: string;              // Error message (red, below input)
  hint?: string;               // Helper text (gray, below input)
  required?: boolean;          // Shows asterisk in label
  accessibilityLabel?: string; // Screen reader label

  // Styling
  containerStyle?: ViewStyle;  // Outer View style
  inputStyle?: TextStyle;      // Inner TextInput style

  // Layout
  fullWidth?: boolean;         // Default: true (100% width)
}
```

## Common Use Cases

### Email input with validation

```tsx
<TextInputField
  label="Email Address"
  placeholder="user@example.com"
  keyboardType="email-address"
  value={email}
  onChangeText={setEmail}
  error={validator.emailError}
  required
/>
```

### Password input

```tsx
<TextInputField
  label="Password"
  placeholder="••••••••"
  secureTextEntry={true}
  value={password}
  onChangeText={setPassword}
  error={validator.passwordError}
  hint="Minimum 8 characters"
  required
/>
```

### Optional field with helper text

```tsx
<TextInputField
  label="Company Website"
  placeholder="https://example.com"
  value={website}
  onChangeText={setWebsite}
  hint="Leave blank if you don't have one"
/>
```

### Phone input with validation

```tsx
<TextInputField
  label="Phone Number"
  placeholder="+371 200 00000"
  keyboardType="phone-pad"
  value={phone}
  onChangeText={setPhone}
  error={validator.phoneError}
  maxLength={20}
  required
/>
```

### Large textarea

```tsx
<TextInputField
  label="Message"
  placeholder="Type your message here..."
  multiline
  numberOfLines={4}
  value={message}
  onChangeText={setMessage}
  error={validator.messageError}
  inputStyle={{ textAlignVertical: 'top' }}
/>
```

## Styling Customization

### Override individual field styling

```tsx
<TextInputField label="Custom Background" inputStyle={{ backgroundColor: '#f9fafb' }} />
```

### Override container (add margin, width constraints, etc.)

```tsx
<TextInputField label="Half-width field" containerStyle={{ width: '50%' }} />
```

## Accessibility Checklist

- ✅ Label is properly associated via `accessibilityLabel`
- ✅ Focus state visually distinct (border emphasis)
- ✅ Error message announced to screen readers
- ✅ Minimum 44px touch target (height + padding)
- ✅ Sufficient color contrast (text on background)
- ✅ Placeholder text is supplementary, not replacement for label

## Migration Checklist

Use this component in the following priority:

**Phase 1 - Auth flows (highest impact):**

- [ ] `apps/mobile/app/(auth)/login.tsx`
- [ ] `apps/mobile/app/(auth)/register.tsx`
- [ ] `apps/mobile/app/(auth)/forgot-password.tsx`
- [ ] `apps/mobile/app/(auth)/apply-role.tsx`

**Phase 2 - Order/RFQ flows:**

- [ ] `apps/mobile/app/order-request-new.tsx` (Uber-style fields)
- [ ] `apps/mobile/app/disposal/index.tsx` (disposal order)
- [ ] `apps/mobile/app/(buyer)/rfq/[id].tsx` (quote request)

**Phase 3 - Driver/Seller management:**

- [ ] `apps/mobile/app/(driver)/vehicles.tsx` (vehicle registration)
- [ ] `apps/mobile/app/(driver)/profile.tsx` (profile editing)
- [ ] `apps/mobile/app/(seller)/profile.tsx` (seller profile)

**Phase 4 - Remaining flows:**

- [ ] Chat/messaging inputs
- [ ] Search inputs
- [ ] Address pickers
- [ ] All other TextInput usages in app

## Benefits After Migration

1. **Consistency**: All form inputs look and behave identically
2. **Maintainability**: Change styling in one place, affects all forms
3. **Accessibility**: Built-in screen reader support
4. **Development Speed**: Copy-paste component instead of writing styles
5. **Type Safety**: TypeScript props ensure correct usage
6. **Token Integration**: Uses centralized design system (colors, spacing)

## Questions?

Refer to `/apps/mobile/components/ui/TextInputField.tsx` for implementation details or check `STATUS.md` for component usage updates.
