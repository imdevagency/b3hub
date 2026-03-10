// react-native-gesture-handler MUST be the first import in the app entry point
import 'react-native-gesture-handler';
// Root component used when expo is hoisted to the monorepo root.
// expo/AppEntry.js (at b3hub/node_modules/expo/AppEntry.js) resolves
// "../../App" to b3hub/App.tsx which is redirected here by metro.config.js.
//
// Mirrors what expo-router/build/qualified-entry does, but with require.context
// pointing explicitly at apps/mobile/app so routes are discovered correctly.
import '@expo/metro-runtime';
import React from 'react';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { Head } from 'expo-router/build/head';

const ctx = require.context(
  './app',
  true,
  // Exclude API routes (+api.tsx) and root +html.tsx — same filter as expo-router/_ctx.js
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+html)))\.[tj]sx?$).*\.[tj]sx?$/,
);

export default function App() {
  return (
    <Head.Provider>
      <ExpoRoot context={ctx} />
    </Head.Provider>
  );
}
