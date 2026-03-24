const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can resolve workspace packages
config.watchFolders = [monorepoRoot];

// Resolve modules from mobile first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Packages hoisted to monorepo root that Metro can't find when the import
// originates from inside another node_modules package.
const rootHoisted = ['hoist-non-react-statics', 'memoize-one'];

// Local workspace packages — resolve directly to their source tree so
// Metro doesn't have to follow the npm symlink.
const workspacePackages = {
  '@b3hub/shared': path.resolve(monorepoRoot, 'packages/shared/src/index.ts'),
};

// Guarantee a single React instance — intercepts ALL require('react') calls
// including those originating from inside node_modules (e.g. react-native)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Resolve local workspace packages directly to their source
  if (workspacePackages[moduleName]) {
    return { filePath: workspacePackages[moduleName], type: 'sourceFile' };
  }

  // Resolve @/ path aliases to the mobile project root
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(
      context,
      path.resolve(projectRoot, moduleName.slice(2)),
      platform,
    );
  }

  // Explicitly resolve hoisted packages — works regardless of where the
  // import originates, even from deep inside node_modules/.
  if (rootHoisted.includes(moduleName)) {
    return {
      filePath: require.resolve(moduleName, {
        paths: [path.resolve(monorepoRoot, 'node_modules')],
      }),
      type: 'sourceFile',
    };
  }

  if (moduleName === 'react') {
    return {
      filePath: require.resolve('react', {
        paths: [path.resolve(monorepoRoot, 'node_modules')],
      }),
      type: 'sourceFile',
    };
  }

  // When expo is hoisted to the monorepo root, expo/AppEntry.js resolves
  // "../../App" relative to b3hub/node_modules/expo/ (i.e. b3hub/App),
  // which doesn't exist. Redirect it to the mobile project's App.tsx instead.
  if (
    moduleName === '../../App' &&
    context.originModulePath.includes(path.join(monorepoRoot, 'node_modules', 'expo', 'AppEntry'))
  ) {
    return {
      filePath: path.resolve(projectRoot, 'App.tsx'),
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
