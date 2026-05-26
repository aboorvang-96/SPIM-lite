// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force Metro to use the legacy `main` field instead of `package.exports`.
// Packages like zustand@4.5 ship ESM `.mjs` files containing `import.meta.env`,
// which the web bundle loads via a non-module <script> tag and crashes with
// "Cannot use 'import.meta' outside a module", producing a blank screen.
// Disabling package-exports resolution makes Metro pick the CJS entry that
// does not use `import.meta`.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
