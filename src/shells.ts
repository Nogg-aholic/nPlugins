import * as vscode from 'vscode';

export type ProxyShellId =
  | 'nPlugins.sidebar.content'
  | 'nPlugins.output.primary'
  | 'nPlugins.status.primary'
  | 'nPlugins.terminal.primary';

export type ProxyShellRegistry = {
  output: {
    createPrimaryChannel: (name?: string) => vscode.OutputChannel;
    showChannel: (channel: vscode.OutputChannel, preserveFocus?: boolean) => void;
  };
  statusBar: {
    createPrimaryItem: (args?: { alignment?: vscode.StatusBarAlignment; priority?: number }) => vscode.StatusBarItem;
  };
  terminals: {
    createPrimaryTerminal: (options?: vscode.TerminalOptions) => vscode.Terminal;
  };
};

export function createProxyShellRegistry(): ProxyShellRegistry {
  return {
    output: {
      createPrimaryChannel(name) {
        return vscode.window.createOutputChannel(name ?? 'nPlugins');
      },
      showChannel(channel, preserveFocus) {
        channel.show(preserveFocus);
      },
    },
    statusBar: {
      createPrimaryItem(args) {
        return vscode.window.createStatusBarItem(args?.alignment, args?.priority);
      },
    },
    terminals: {
      createPrimaryTerminal(options) {
        return vscode.window.createTerminal({ name: 'nPlugins', ...options });
      },
    },
  };
}
