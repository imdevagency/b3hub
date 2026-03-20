/**
 * TextInputField — standardized form input component
 *
 * Provides consistent styling for text inputs across the entire app:
 * - Clear focus states with visual feedback
 * - Error state styling with red border
 * - Placeholder color using design tokens
 * - Accessibility labels and roles
 * - Optional label, error message, and hint text
 *
 * @example
 *   <TextInputField
 *     label="Email"
 *     placeholder="you@example.com"
 *     value={email}
 *     onChangeText={setEmail}
 *     error={errors.email}
 *     hint="We'll never share your email"
 *   />
 */

import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '@/lib/theme';

interface TextInputFieldProps extends Omit<RNTextInputProps, 'style'> {
  /** Label displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Hint/helper text displayed below the input (when no error) */
  hint?: string;
  /** Extra style applied to the outer container */
  containerStyle?: ViewStyle;
  /** Extra style applied to the TextInput itself */
  inputStyle?: TextStyle;
  /** Whether the field is required (shows asterisk in label) */
  required?: boolean;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Whether to make this field full width or not */
  fullWidth?: boolean;
}

export function TextInputField({
  label,
  error,
  hint,
  containerStyle,
  inputStyle,
  required = false,
  accessibilityLabel,
  fullWidth = true,
  placeholderTextColor = colors.textMuted,
  ...inputProps
}: TextInputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle, !fullWidth && styles.containerNarrow]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.asterisk}>*</Text>}
        </Text>
      )}

      <RNTextInput
        {...inputProps}
        placeholderTextColor={placeholderTextColor}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          inputStyle,
        ]}
        onFocus={(e) => {
          setIsFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          inputProps.onBlur?.(e);
        }}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="none"
        accessibilityHint={hint}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
      {!error && hint && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs, // 4px gap between elements
  },
  containerNarrow: {
    maxWidth: '50%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  asterisk: {
    color: colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.base, // 16px
    paddingVertical: spacing.sm, // 8px, but appears as ~14px due to text metrics
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgCard,
    minHeight: 44, // iOS minimum touch target
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    borderWidth: 2, // Emphasize focus
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.danger,
    marginTop: spacing.xs, // 4px
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs, // 4px
  },
});
