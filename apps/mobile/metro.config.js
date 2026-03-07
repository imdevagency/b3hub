const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can resolve workspace packages
config.watchFolders = [monorepoRoot];

// Resolve modules from mobile first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Guarantee a single React instance — intercepts ALL require('react') calls
// including those originating from inside node_modules (e.g. react-native)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Resolve @/ path aliases to the mobile project root
  if (moduleName.startsWith("@/")) {
    return context.resolveRequest(
      context,
      path.resolve(projectRoot, moduleName.slice(2)),
      platform
    );
  }

  if (moduleName === "react") {
    return {
      filePath: require.resolve("react", {
        paths: [path.resolve(monorepoRoot, "node_modules")],
      }),
      type: "sourceFile",
    };
  }

  // When expo is hoisted to the monorepo root, expo/AppEntry.js resolves
  // "../../App" relative to b3hub/node_modules/expo/ (i.e. b3hub/App),
  // which doesn't exist. Redirect it to the mobile project's App.tsx instead.
  if (
    moduleName === "../../App" &&
    context.originModulePath.includes(
      path.join(monorepoRoot, "node_modules", "expo", "AppEntry")
    )
  ) {
    return {
      filePath: path.resolve(projectRoot, "App.tsx"),
      type: "sourceFile",
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

