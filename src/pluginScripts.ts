import * as vscode from 'vscode';
import type { StartupPluginRegistryEntry } from './pluginRegistry.js';
import type { PluginScriptDefinition } from './pluginManifest.js';
import type { ProxyShellRegistry } from './shells.js';

export type PluginScriptRuntimeInfo = {
  script: string;
  command: string;
  terminalName: string;
  running: boolean;
};

type ScriptRuntime = {
  definition: PluginScriptDefinition;
  terminal: vscode.Terminal;
  reused: boolean;
};

export class PluginScriptManager implements vscode.Disposable {
  private readonly runtimes = new Map<string, Map<string, ScriptRuntime>>();
  private readonly terminalCloseSubscription: vscode.Disposable;

  constructor(private readonly shells: ProxyShellRegistry) {
    this.terminalCloseSubscription = vscode.window.onDidCloseTerminal((terminal) => {
      this.dropTerminalReference(terminal);
    });
  }

  startAutorun(entry: StartupPluginRegistryEntry): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    for (const scriptName of entry.config.autorun ?? []) {
      const runtime = this.startScript(entry, scriptName);
      if (runtime) {
        disposables.push({
          dispose: () => this.stopScript(entry.config.id, scriptName),
        });
      }
    }
    return disposables;
  }

  startScript(entry: StartupPluginRegistryEntry, scriptName: string): vscode.Terminal | undefined {
    const script = entry.config.scripts?.[scriptName];
    if (!script) {
      throw new Error(`Unknown script ${entry.config.id}:${scriptName}`);
    }

    const pluginScripts = this.runtimes.get(entry.config.id) ?? new Map<string, ScriptRuntime>();
    const existing = pluginScripts.get(scriptName);
    if (existing) {
      existing.terminal.show(true);
      return existing.terminal;
    }

    const terminalName = this.getTerminalName(entry.config.id, scriptName);
    const restored = this.findRunningTerminal(terminalName);
    if (restored) {
      pluginScripts.set(scriptName, {
        definition: script,
        terminal: restored,
        reused: true,
      });
      this.runtimes.set(entry.config.id, pluginScripts);
      restored.show(true);
      return restored;
    }

    const terminal = this.shells.terminals.createPrimaryTerminal({
      name: terminalName,
      cwd: entry.packageRoot,
      isTransient: false,
      hideFromUser: false,
    });
    terminal.show(true);
    terminal.sendText(script.command, true);

    pluginScripts.set(scriptName, {
      definition: script,
      terminal,
      reused: false,
    });
    this.runtimes.set(entry.config.id, pluginScripts);
    return terminal;
  }

  stopPlugin(pluginId: string): void {
    const pluginScripts = this.runtimes.get(pluginId);
    if (!pluginScripts) {
      return;
    }

    for (const runtime of pluginScripts.values()) {
      if (!runtime.reused) {
        runtime.terminal.dispose();
      }
    }
    this.runtimes.delete(pluginId);
  }

  stopScript(pluginId: string, scriptName: string): void {
    const pluginScripts = this.runtimes.get(pluginId);
    const runtime = pluginScripts?.get(scriptName);
    if (!runtime) {
      return;
    }

    if (!runtime.reused) {
      runtime.terminal.dispose();
    }
    pluginScripts?.delete(scriptName);
    if (pluginScripts && pluginScripts.size === 0) {
      this.runtimes.delete(pluginId);
    }
  }

  runScript(entries: readonly StartupPluginRegistryEntry[], pluginId: string, scriptName: string): void {
    const entry = entries.find((candidate) => candidate.config.id === pluginId);
    if (!entry) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    this.startScript(entry, scriptName);
  }

  getPluginScripts(entries: readonly StartupPluginRegistryEntry[], pluginId: string): PluginScriptRuntimeInfo[] {
    const entry = entries.find((candidate) => candidate.config.id === pluginId);
    if (!entry) {
      return [];
    }

    const running = this.runtimes.get(pluginId) ?? new Map<string, ScriptRuntime>();
    return Object.entries(entry.config.scripts ?? {}).map(([script, definition]) => ({
      script,
      command: definition.command,
      terminalName: this.getTerminalName(pluginId, script),
      running: running.has(script),
    }));
  }

  dispose(): void {
    this.runtimes.clear();
    this.terminalCloseSubscription.dispose();
  }

  private getTerminalName(pluginId: string, scriptName: string): string {
    return `${pluginId}:${scriptName}`;
  }

  private findRunningTerminal(name: string): vscode.Terminal | undefined {
    return vscode.window.terminals.find((terminal) => terminal.name === name);
  }

  private dropTerminalReference(terminal: vscode.Terminal): void {
    for (const [pluginId, pluginScripts] of this.runtimes) {
      for (const [scriptName, runtime] of pluginScripts) {
        if (runtime.terminal !== terminal) {
          continue;
        }

        pluginScripts.delete(scriptName);
        if (pluginScripts.size === 0) {
          this.runtimes.delete(pluginId);
        }
        return;
      }
    }
  }
}
