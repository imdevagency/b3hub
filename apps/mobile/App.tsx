// This file is used as the root component when expo is hoisted to the monorepo
// root and expo/AppEntry.js can't resolve its default "../../App" import.
// It re-exports expo-router's App so full file-based routing still works.
import '@expo/metro-runtime';
export { App as default } from 'expo-router/build/qualified-entry';
