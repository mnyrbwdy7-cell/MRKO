// Expo's default Metro config plus the WebAssembly asset required by
// expo-sqlite's web implementation (wa-sqlite).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

module.exports = config;
