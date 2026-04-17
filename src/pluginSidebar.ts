import * as vscode from 'vscode';
import type { PluginHost, PluginRuntimeInfo } from './pluginHost.js';

const VIEW_ID = 'nPlugins.sidebar.plugins';

class PluginItem extends vscode.TreeItem {
  constructor(readonly plugin: PluginRuntimeInfo) {
    super(plugin.id, vscode.TreeItemCollapsibleState.None);
    this.id = plugin.id;
    const runningScripts = plugin.scripts.filter((script) => script.running).length;
    this.description = plugin.error
      ? `${plugin.state} | error`
      : runningScripts > 0
        ? `${plugin.state} | ${runningScripts} script${runningScripts === 1 ? '' : 's'}`
        : plugin.state;
    this.tooltip = plugin.error
      ? `${plugin.packageRoot}\n${plugin.configPath}\n\nScripts:\n${formatScripts(plugin)}\n\nError: ${plugin.error}`
      : `${plugin.packageRoot}\n${plugin.configPath}\n\nScripts:\n${formatScripts(plugin)}`;
    this.contextValue = plugin.error ? `plugin:${plugin.state}:error` : `plugin:${plugin.state}`;
    this.iconPath = plugin.error
      ? new vscode.ThemeIcon('error')
      : new vscode.ThemeIcon(plugin.state === 'running' ? 'play-circle' : 'circle-large-outline');
  }
}

function formatScripts(plugin: PluginRuntimeInfo): string {
  if (plugin.scripts.length === 0) {
    return '(none)';
  }

  return plugin.scripts
    .map((script) => `${script.running ? '[running]' : '[stopped]'} ${script.script}: ${script.command}`)
    .join('\n');
}

class PluginProvider implements vscode.TreeDataProvider<PluginItem> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly host: PluginHost) {}

  getTreeItem(element: PluginItem): vscode.TreeItem {
    return element;
  }

  getChildren(): PluginItem[] {
    return this.host.getPlugins().map((plugin) => new PluginItem(plugin));
  }

  refresh(): void {
    this.emitter.fire();
  }
}

export function registerPluginSidebar(context: vscode.ExtensionContext, host: PluginHost): vscode.Disposable[] {
  const provider = new PluginProvider(host);
  const view = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: false,
  });

  const withId = async (value: PluginItem | string | undefined, action: (id: string) => void) => {
    const id = typeof value === 'string' ? value : value?.plugin.id;
    if (!id) {
      return;
    }
    action(id);
  };

  const disposables: vscode.Disposable[] = [
    view,
    host.onDidChange(() => provider.refresh()),
    vscode.commands.registerCommand('nPlugins.openSidebar', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.nPlugins');
    }),
    vscode.commands.registerCommand('nPlugins.plugin.start', async (item?: PluginItem | string) => {
      await withId(item, (id) => host.start(id));
    }),
    vscode.commands.registerCommand('nPlugins.plugin.stop', async (item?: PluginItem | string) => {
      await withId(item, (id) => host.stop(id));
    }),
    vscode.commands.registerCommand('nPlugins.refreshPlugins', async () => {
      host.refreshDefinitions();
    }),
    vscode.commands.registerCommand('nPlugins.pluginScript', async (pluginId?: string, scriptName?: string) => {
      if (!pluginId || !scriptName) {
        throw new Error('nPlugins.pluginScript requires pluginId and scriptName.');
      }
      host.runScript(pluginId, scriptName);
    }),
  ];

  context.subscriptions.push(...disposables);
  return disposables;
}
