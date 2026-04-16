/**
 * HeaderContext — allows tab screens to signal that the layout-level TopBar
 * should be visible, and optionally pass a custom centerElement (used by the
 * driver home screen for the online/offline status pill).
 *
 * Usage:
 *   1. Wrap the role layout's inner component with <HeaderProvider>.
 *   2. In the layout, read `config` from useHeaderConfig() and render
 *      `{config !== null && <TopBar ...>}` above <Tabs>.
 *   3. In home screens: call setConfig({}) on focus, setConfig(null) on blur.
 *      For driver home, pass centerElement in the config object.
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface LayoutHeaderConfig {
  /** Optional custom center slot — used by driver home for the status pill. */
  centerElement?: ReactNode;
}

interface HeaderContextValue {
  /** null = TopBar hidden; object = TopBar visible with optional config */
  config: LayoutHeaderConfig | null;
  setConfig: (config: LayoutHeaderConfig | null) => void;
}

const HeaderContext = createContext<HeaderContextValue>({
  config: null,
  setConfig: () => {},
});

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<LayoutHeaderConfig | null>(null);
  const setConfig = useCallback((c: LayoutHeaderConfig | null) => setConfigState(c), []);
  return (
    <HeaderContext.Provider value={{ config, setConfig }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeaderConfig() {
  return useContext(HeaderContext);
}
