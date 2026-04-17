import * as vscode from 'vscode';
import type { PluginHost } from './pluginHost.js';
import type {
  PluginOutputSurfaceDefinition,
  PluginStatusSurfaceDefinition,
  PluginTerminalSurfaceDefinition,
} from './pluginManifest.js';
import type { ProxyShellRegistry } from './shells.js';
import {
  getDisplayTitle,
  getSurfaceRegistrations,
  htmlToLines,
  resolveHtmlLikeContent,
} from './pluginSurfaceContent.js';

export function registerPluginSurfaces(
  context: vscode.ExtensionContext,
  host: PluginHost,
  shells: ProxyShellRegistry,
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  const statusItems: vscode.Disposable[] = [];
  const outputChannels = new Map<string, vscode.OutputChannel>();
  const terminals = new Map<string, vscode.Terminal>();

  const render = () => {
    for (const disposable of statusItems.splice(0).reverse()) {
      disposable.dispose();
    }

    for (const channel of outputChannels.values()) {
      channel.dispose();
    }
    outputChannels.clear();

    for (const terminal of terminals.values()) {
      terminal.dispose();
    }
    terminals.clear();

    for (const registration of getSurfaceRegistrations(host.getDefinitions(), 'nPlugins.output.primary')) {
      const definition = registration.definition as PluginOutputSurfaceDefinition;
      if (definition.type !== 'output') {
        continue;
      }
      const channel = shells.output.createPrimaryChannel(`${registration.entry.config.id}: ${getDisplayTitle(registration.entry, definition)}`);
      channel.appendLine(`[plugin] ${registration.entry.config.id}`);
      for (const line of htmlToLines(resolveHtmlLikeContent(registration.entry, registration.surfaceId, definition))) {
        channel.appendLine(line);
      }
      outputChannels.set(registration.entry.config.id, channel);
    }

    for (const registration of getSurfaceRegistrations(host.getDefinitions(), 'nPlugins.status.primary')) {
      const definition = registration.definition as PluginStatusSurfaceDefinition;
      if (definition.type !== 'status') {
        continue;
      }
      const item = shells.statusBar.createPrimaryItem({
        alignment: definition.alignment === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right,
        priority: definition.priority,
      });
      item.name = registration.entry.config.id;
      item.text = definition.text;
      item.tooltip = definition.tooltip;
      if (definition.command) {
        item.command = definition.command;
      }
      item.show();
      statusItems.push(item);
    }

    for (const registration of getSurfaceRegistrations(host.getDefinitions(), 'nPlugins.terminal.primary')) {
      const definition = registration.definition as PluginTerminalSurfaceDefinition;
      if (definition.type !== 'terminal' || !definition.script) {
        continue;
      }
      const terminal = shells.terminals.createPrimaryTerminal({
        name: `${registration.entry.config.id}: ${definition.title ?? definition.script}`,
        cwd: registration.entry.packageRoot,
        isTransient: false,
        hideFromUser: false,
      });
      terminal.sendText(`echo Surface registered for ${registration.entry.config.id}:${definition.script}`, true);
      terminals.set(registration.entry.config.id, terminal);
    }
  };

  render();

  disposables.push(
    host.onDidChange(() => render()),
    {
      dispose: () => {
        for (const disposable of statusItems.splice(0).reverse()) {
          disposable.dispose();
        }
        for (const channel of outputChannels.values()) {
          channel.dispose();
        }
        outputChannels.clear();
        for (const terminal of terminals.values()) {
          terminal.dispose();
        }
        terminals.clear();
      },
    },
  );

  context.subscriptions.push(...disposables);
  return disposables;
}
