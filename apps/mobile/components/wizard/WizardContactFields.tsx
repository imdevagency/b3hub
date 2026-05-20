/**
 * WizardContactFields
 *
 * Seamless iOS-Settings-style contact input card shared across all wizard
 * confirmation steps. Renders name + phone as required fields; email and
 * notes are optional and hidden when their handlers are omitted.
 *
 * An `extras` prop slot lets each wizard append its own bespoke inputs
 * inside the same visual container.
 *
 * Usage:
 *   <WizardContactFields
 *     name={contactName}        onChangeName={setContactName}
 *     phone={contactPhone}      onChangePhone={setContactPhone}
 *     email={contactEmail}      onChangeEmail={setContactEmail}
 *     notes={notes}             onChangeNotes={setNotes}
 *   />
 *
 *   // With extras (e.g. BIS number):
 *   <WizardContactFields
 *     name={contactName} onChangeName={setContactName}
 *     phone={contactPhone} onChangePhone={setContactPhone}
 *     extras={
 *       <TextInput
 *         placeholder="BIS numurs (neobligāts)"
 *         value={bisNumber}
 *         onChangeText={setBisNumber}
 *         style={wizardInputStyle}
 *       />
 *     }
 *   />
 */

import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type KeyboardTypeOptions,
} from 'react-native';

// Shared style for each input row — exported so extras match the look
export const wizardInputStyle = {
  fontSize: 16 as const,
  fontFamily: 'Inter_500Medium',
  padding: 18,
  color: '#111827',
  backgroundColor: '#fff',
} as const;

const PLACEHOLDER_COLOR = '#9CA3AF';

interface Props {
  name: string;
  onChangeName: (v: string) => void;
  namePlaceholder?: string;

  phone: string;
  onChangePhone: (v: string) => void;
  phonePlaceholder?: string;

  email?: string;
  onChangeEmail?: (v: string) => void;
  emailPlaceholder?: string;

  notes?: string;
  onChangeNotes?: (v: string) => void;
  notesPlaceholder?: string;

  /** Additional input nodes rendered at the bottom of the card, inside the same container */
  extras?: React.ReactNode;

  style?: StyleProp<ViewStyle>;
}

export function WizardContactFields({
  name,
  onChangeName,
  namePlaceholder = 'Kontaktpersona',
  phone,
  onChangePhone,
  phonePlaceholder = 'Tālrunis',
  email,
  onChangeEmail,
  emailPlaceholder = 'E-pasts (neobligāti)',
  notes,
  onChangeNotes,
  notesPlaceholder = 'Piezīmes (piem., piekļuves kods, vietas apraksts)',
  extras,
  style,
}: Props) {
  const showEmail = onChangeEmail !== undefined;
  const showNotes = onChangeNotes !== undefined;

  return (
    <View style={[s.card, style]}>
      {/* Name */}
      <TextInput
        placeholder={namePlaceholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={name}
        onChangeText={onChangeName}
        style={[wizardInputStyle, s.divider]}
      />

      {/* Phone */}
      <TextInput
        placeholder={phonePlaceholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={phone}
        onChangeText={onChangePhone}
        keyboardType="phone-pad"
        style={[wizardInputStyle, showEmail || showNotes || extras ? s.divider : undefined]}
      />

      {/* Email (optional) */}
      {showEmail && (
        <TextInput
          placeholder={emailPlaceholder}
          placeholderTextColor={PLACEHOLDER_COLOR}
          value={email ?? ''}
          onChangeText={onChangeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[wizardInputStyle, showNotes || extras ? s.divider : undefined]}
        />
      )}

      {/* Notes (optional) */}
      {showNotes && (
        <TextInput
          placeholder={notesPlaceholder}
          placeholderTextColor={PLACEHOLDER_COLOR}
          value={notes ?? ''}
          onChangeText={onChangeNotes}
          multiline
          style={[
            wizardInputStyle,
            { minHeight: 80, textAlignVertical: 'top' },
            extras ? s.divider : undefined,
          ]}
        />
      )}

      {/* Wizard-specific extras (e.g. BIS number) */}
      {extras}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 24,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
});
