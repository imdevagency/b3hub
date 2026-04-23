import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/lib/theme';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary for React Native / Expo.
 * Wraps subtrees and displays a recovery UI on uncaught render errors.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeScreen />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Navigation context errors are transient (hot-reload / navigation init race).
    // Don't show the fallback UI for them — let the tree recover on its own.
    if (error.message.includes('navigation context')) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Navigation-context errors are a transient race during hot-reload / initial
    // Expo Router boot. getDerivedStateFromError already suppresses the fallback
    // UI for them; don't console.error here either, so Expo LogBox doesn't show
    // a red overlay for something that self-heals within one render cycle.
    if (error.message.includes('navigation context')) {
      if (__DEV__)
        console.warn(
          '[ErrorBoundary] transient navigation context error (auto-recovering)',
          error.message,
        );
      return;
    }
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>⚠️</Text>
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>An unexpected error occurred. Please try again.</Text>
          {__DEV__ && this.state.error && (
            <ScrollView style={styles.devError}>
              <Text style={styles.devErrorText}>{this.state.error.message}</Text>
            </ScrollView>
          )}
          <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    // Guard against hot-reload partial module evaluation where colors may be
    // temporarily undefined. The fallback matches the design token value.
    backgroundColor: colors?.dangerBg ?? '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 28 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors?.textMuted ?? '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  devError: {
    maxHeight: 160,
    backgroundColor: colors?.bgMuted ?? '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  devErrorText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'Courier New',
  },
  button: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
