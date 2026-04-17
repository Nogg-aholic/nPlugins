import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { PluginManifest } from './pluginManifest.js';

export type StartupPluginRegistryEntry = {
  configPath: string;
  packageRoot: string;
  config: PluginManifest;
};

type StartupPluginRegistryPluginSource = {
  packageRoot?: string;
  config?: string;
};

type StartupPluginRegistryPlugin = {
  packageRoot?: string;
  config?: string;
  source?: StartupPluginRegistryPluginSource;
};

export type StartupPluginRegistryDocument = {
  plugins?: StartupPluginRegistryPlugin[];
};

export function loadStartupPluginRegistry(workspaceFolders: readonly vscode.WorkspaceFolder[]): StartupPluginRegistryEntry[] {
  const folders = Array.isArray(workspaceFolders) ? workspaceFolders : [];
  const registryFiles = folders
    .map((folder) => path.join(folder.uri.fsPath, 'plugins.json'))
    .filter((candidate) => fs.existsSync(candidate));

  const entries: StartupPluginRegistryEntry[] = [];
  for (const registryPath of registryFiles) {
    const raw = fs.readFileSync(registryPath, 'utf8');
    const parsed = JSON.parse(raw) as StartupPluginRegistryDocument;
    const registryDir = path.dirname(registryPath);

    for (const plugin of parsed.plugins ?? []) {
      const source = plugin.source ?? plugin;
      if (typeof source.packageRoot !== 'string' || source.packageRoot.length === 0) {
        continue;
      }

      const packageRoot = path.resolve(registryDir, source.packageRoot);
      const configName = typeof source.config === 'string' && source.config.length > 0
        ? source.config
        : fs.existsSync(path.resolve(packageRoot, 'plugin.json'))
          ? 'plugin.json'
          : 'plugin.config.json';
      const configPath = path.resolve(packageRoot, configName);
      if (!fs.existsSync(configPath)) {
        continue;
      }
      const configRaw = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configRaw) as PluginManifest;
      entries.push({
        configPath,
        packageRoot,
        config,
      });
    }
  }

  return entries;
}
