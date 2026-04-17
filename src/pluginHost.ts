import * as vscode from 'vscode';
import { loadStartupPluginRegistry, type StartupPluginRegistryEntry } from './pluginRegistry.js';
import { PluginScriptManager, type PluginScriptRuntimeInfo } from './pluginScripts.js';
import type { ProxyShellRegistry } from './shells.js';

export type PluginRuntimeState = 'running' | 'stopped';

export type PluginRuntimeInfo = {
  id: string;
  configPath: string;
  packageRoot: string;
  state: PluginRuntimeState;
  error?: string;
  scripts: PluginScriptRuntimeInfo[];
};

type RuntimeEntry = {
  definition: StartupPluginRegistryEntry;
  store: vscode.Disposable[];
};

type Listener = () => void;

export class PluginHost implements vscode.Disposable {
  private readonly listeners = new Set<Listener>();
  private definitions: StartupPluginRegistryEntry[] = [];
  private readonly running = new Map<string, RuntimeEntry>();
  private readonly errors = new Map<string, string>();
  private readonly scriptManager: PluginScriptManager;

  constructor(
    private readonly workspaceFolders: readonly vscode.WorkspaceFolder[],
    shells: ProxyShellRegistry,
  ) {
    this.scriptManager = new PluginScriptManager(shells);
    this.refreshDefinitions();
  }

  onDidChange(listener: Listener): vscode.Disposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  refreshDefinitions(): void {
    this.definitions = loadStartupPluginRegistry(this.workspaceFolders);
    this.emitChange();
  }

  getDefinitions(): readonly StartupPluginRegistryEntry[] {
    return this.definitions;
  }

  autoStart(): void {
    this.refreshDefinitions();
    for (const definition of this.definitions) {
      if (!this.running.has(definition.config.id)) {
        try {
          this.start(definition.config.id);
        } catch {
          // Preserve per-plugin error state without aborting extension activation.
        }
      }
    }
  }

  start(id: string): void {
    if (this.running.has(id)) {
      return;
    }
    const definition = this.definitions.find((entry) => entry.config.id === id);
    if (!definition) {
      throw new Error(`Unknown plugin: ${id}`);
    }

    try {
      const store = this.scriptManager.startAutorun(definition);
      this.errors.delete(id);
      this.running.set(id, { definition, store });
    } catch (error) {
      this.errors.set(id, error instanceof Error ? error.message : String(error));
      throw error;
    }
    this.emitChange();
  }

  stop(id: string): void {
    const entry = this.running.get(id);
    if (!entry) {
      return;
    }
    this.running.delete(id);
    for (const disposable of entry.store.splice(0).reverse()) {
      disposable.dispose();
    }
    this.scriptManager.stopPlugin(id);
    this.emitChange();
  }

  runScript(pluginId: string, scriptName: string): void {
    this.scriptManager.runScript(this.definitions, pluginId, scriptName);
    this.emitChange();
  }

  getPlugins(): PluginRuntimeInfo[] {
    return this.definitions.map((definition) => ({
      id: definition.config.id,
      configPath: definition.configPath,
      packageRoot: definition.packageRoot,
      state: this.running.has(definition.config.id) ? 'running' : 'stopped',
      error: this.errors.get(definition.config.id),
      scripts: this.scriptManager.getPluginScripts(this.definitions, definition.config.id),
    }));
  }

  dispose(): void {
    this.running.clear();
    this.scriptManager.dispose();
    this.listeners.clear();
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
