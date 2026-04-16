/**
 * AppProviders
 *
 * Wraps all global context providers in one place so _layout.tsx stays minimal.
 * Order matters: AuthProvider must be inside SafeAreaProvider, and LanguageProvider
 * must wrap ModeProvider (locale-aware mode labels).
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { ModeProvider } from '@/lib/mode-context';
import { ToastProvider } from '@/components/ui/Toast';
import { LanguageProvider } from '@/lib/language-context';

interface Props {
  children: React.ReactNode;
}

export function AppProviders({ children }: Props) {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <LanguageProvider>
            <ModeProvider>{children}</ModeProvider>
          </LanguageProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
