/**
 * npm workspaces hoist packages to the monorepo root, but TypeScript's
 * tsconfig "extends" resolution in nested node_modules packages doesn't
 * always walk all the way up to the workspace root. This script creates
 * local symlinks so those inner tsconfigs can resolve their dependencies.
 */
const { symlinkSync, existsSync, mkdirSync } = require('fs');
const { resolve } = require('path');

const rootModules = resolve(__dirname, '../../../node_modules');
const localModules = resolve(__dirname, '../node_modules');

// Packages that need to be visible within apps/mobile/node_modules
const hoistedPackages = ['expo-module-scripts'];

mkdirSync(localModules, { recursive: true });

for (const pkg of hoistedPackages) {
  const src = resolve(rootModules, pkg);
  const dest = resolve(localModules, pkg);
  if (existsSync(src) && !existsSync(dest)) {
    try {
      symlinkSync(src, dest, 'dir');
      console.log(`Linked ${pkg} → root node_modules`);
    } catch (e) {
      // Symlink already exists or permission issue — ignore
    }
  }
}
