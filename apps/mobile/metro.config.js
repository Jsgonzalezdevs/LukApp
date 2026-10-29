const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const appRoot = __dirname;
const repositoryRoot = path.resolve(appRoot, '../..');
const config = getDefaultConfig(appRoot);

// Native and web clients import the same financial repository and calculations.
config.watchFolders = [...config.watchFolders, repositoryRoot];
config.resolver.nodeModulesPaths = [
  path.join(appRoot, 'node_modules'),
  path.join(repositoryRoot, 'node_modules'),
];

module.exports = config;
