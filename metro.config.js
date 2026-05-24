// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for 3D file extensions
config.resolver.assetExts.push('obj', 'stl', 'glb', 'gltf', 'bin');

module.exports = config;
