import * as vscode from 'vscode';
import { PluginHost } from './pluginHost.js';
import { registerPluginContentSidebar } from './pluginContentSidebar.js';
import { registerPluginSurfaces } from './pluginSurfaceRegistry.js';
import { registerPluginSidebar } from './pluginSidebar.js';
import { createProxyShellRegistry } from './shells.js';

let pluginHost: PluginHost | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const shells = createProxyShellRegistry();
  pluginHost = new PluginHost(vscode.workspace.workspaceFolders ?? [], shells);
  context.subscriptions.push(pluginHost);
  context.subscriptions.push(...registerPluginContentSidebar(context, pluginHost));
  context.subscriptions.push(...registerPluginSurfaces(context, pluginHost, shells));
  context.subscriptions.push(...registerPluginSidebar(context, pluginHost));
  pluginHost.autoStart();
}

export function deactivate(): void {
  pluginHost?.dispose();
  pluginHost = undefined;
}
