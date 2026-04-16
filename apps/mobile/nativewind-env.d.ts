/// <reference types="nativewind/types" />

// Allow side-effect CSS imports (global.css via NativeWind)
declare module '*.css' {}

// Metro require.context (used in App.tsx for monorepo routing)
interface RequireContext {
  (id: string): any;
  keys(): string[];
  resolve(id: string): string;
  id: string;
}

// NativeWind className prop on core React Native components
import 'react-native';
declare module 'react-native' {
  interface ViewProps { className?: string; }
  interface TextProps { className?: string; }
  interface ImageProps { className?: string; }
  interface TextInputProps { className?: string; }
  interface PressableProps { className?: string; }
  interface TouchableOpacityProps { className?: string; }
  interface ScrollViewProps { className?: string; }
}

declare global {
  interface NodeRequire {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp): RequireContext;
  }
}
