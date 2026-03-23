// Root-level Metro config — used when `expo start` is run from the monorepo root.
// Delegates to the mobile app's config and ensures @/ aliases resolve correctly.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const monorepoRoot = __dirname;
const projectRoot = path.resolve(monorepoRoot, 'apps/mobile');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Packages that need explicit resolution because Metro won't cross package
// boundaries when resolving deps required from inside node_modules/.
const rootHoisted = ['hoist-non-react-statics', 'memoize-one'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Resolve @/ path aliases to apps/mobile
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(
      context,
      path.resolve(projectRoot, moduleName.slice(2)),
      platform,
    );
  }

  // Explicitly resolve packages hoisted to monorepo root that Metro can't
  // find when the import originates from inside another node_modules package.
  if (rootHoisted.includes(moduleName)) {
    return {
      filePath: require.resolve(moduleName, {
        paths: [path.resolve(monorepoRoot, 'node_modules')],
      }),
      type: 'sourceFile',
    };
  }

  // Guarantee a single React instance
  if (moduleName === 'react') {
    return {
      filePath: require.resolve('react', {
        paths: [path.resolve(monorepoRoot, 'node_modules')],
      }),
      type: 'sourceFile',
    };
  }

  // Redirect expo/AppEntry's "../../App" to the mobile App.tsx
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
