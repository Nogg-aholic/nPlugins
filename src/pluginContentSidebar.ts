import * as vscode from 'vscode';
import type { PluginHost } from './pluginHost.js';
import {
  getDisplayTitle,
  getShellRegistrations,
  isTreeDefinition,
  resolveHtmlLikeContent,
} from './pluginSurfaceContent.js';

const VIEW_ID = 'nPlugins.sidebar.content';
const SELECT_TAB_COMMAND = 'nPlugins.pluginContent.selectTab';

class PluginContentWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private selectedPluginId: string | undefined;

  constructor(private readonly host: PluginHost) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message && typeof message === 'object' && message.type === 'selectTab' && typeof message.pluginId === 'string') {
        this.selectedPluginId = message.pluginId;
        this.render();
      }
    });
    this.render();
  }

  selectTab(pluginId: string): void {
    this.selectedPluginId = pluginId;
    this.render();
  }

  render(): void {
    if (!this.view) {
      return;
    }

    const registrations = getShellRegistrations(this.host.getDefinitions(), VIEW_ID);
    const selected = registrations.find((registration) => registration.entry.config.id === this.selectedPluginId)
      ?? registrations[0];

    if (!this.selectedPluginId && selected) {
      this.selectedPluginId = selected.entry.config.id;
    }

    this.view.webview.html = renderShellHtml(this.view.webview, registrations, selected);
  }
}

export function registerPluginContentSidebar(context: vscode.ExtensionContext, host: PluginHost): vscode.Disposable[] {
  const provider = new PluginContentWebviewProvider(host);

  const disposables: vscode.Disposable[] = [
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
    host.onDidChange(() => provider.render()),
    vscode.commands.registerCommand(SELECT_TAB_COMMAND, async (pluginId?: string) => {
      if (!pluginId) {
        return;
      }
      provider.selectTab(pluginId);
      await vscode.commands.executeCommand('workbench.view.extension.nPlugins');
    }),
  ];

  context.subscriptions.push(...disposables);
  return disposables;
}

function renderShellHtml(
  webview: vscode.Webview,
  registrations: ReturnType<typeof getShellRegistrations>,
  selected: ReturnType<typeof getShellRegistrations>[number] | undefined,
): string {
  const nonce = String(Date.now());
  const tabs = registrations.length === 0
    ? '<div class="empty">No plugin content registered.</div>'
    : registrations.map((registration) => {
        const active = registration.entry.config.id === selected?.entry.config.id;
        return `<button class="tab${active ? ' active' : ''}" data-plugin-id="${escapeHtml(registration.entry.config.id)}">${escapeHtml(getDisplayTitle(registration.entry, registration.definition))}</button>`;
      }).join('');

  const body = selected
    ? renderSelectedPluginBody(selected)
    : '<div class="empty">No plugin content registered.</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    .tabs {
      display: flex;
      gap: 6px;
      padding: 10px 10px 0 10px;
      border-bottom: 1px solid var(--vscode-sideBar-border);
      position: sticky;
      top: 0;
      background: var(--vscode-sideBar-background);
      z-index: 1;
    }
    .tab {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 6px 6px 0 0;
      padding: 6px 10px;
      cursor: pointer;
    }
    .tab.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .content {
      padding: 12px;
    }
    .meta {
      opacity: 0.8;
      font-size: 12px;
      margin-bottom: 12px;
    }
    .empty {
      padding: 16px;
      opacity: 0.8;
    }
  </style>
  <title>Plugin Content</title>
</head>
<body>
  <div class="tabs">${tabs}</div>
  <div class="content">${body}</div>
  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();
    for (const button of document.querySelectorAll('[data-plugin-id]')) {
      button.addEventListener('click', () => {
        const pluginId = button.getAttribute('data-plugin-id');
        if (pluginId) {
          vscodeApi.postMessage({ type: 'selectTab', pluginId });
        }
      });
    }
  </script>
</body>
</html>`;
}

function renderSelectedPluginBody(registration: ReturnType<typeof getShellRegistrations>[number]): string {
  const header = `<div class="meta">plugin: ${escapeHtml(registration.entry.config.id)}</div>`;

  if (isTreeDefinition(registration.definition)) {
    const items = (registration.definition.items ?? [])
      .map((item) => `<li><strong>${escapeHtml(item.label)}</strong>${item.description ? ` - ${escapeHtml(item.description)}` : ''}</li>`)
      .join('');
    return `${header}<h2>${escapeHtml(getDisplayTitle(registration.entry, registration.definition))}</h2><ul>${items || '<li>(empty)</li>'}</ul>`;
  }

  return `${header}${resolveHtmlLikeContent(registration.entry, registration.surfaceId, registration.definition)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
