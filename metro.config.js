// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prefer React Native platform-specific exports (e.g. Firebase RN builds) over web exports
config.resolver.sourceExts = ['native.js', 'native.ts', 'native.tsx', ...config.resolver.sourceExts];

// Add support for 3D file extensions
config.resolver.assetExts.push('obj', 'stl', 'glb', 'gltf', 'bin');

module.exports = config;
