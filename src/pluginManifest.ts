export type PluginManifest = {
  id: string;
  registrations?: {
    shells?: PluginShellMap;
    surfaces?: PluginSurfaceMap;
  };
  scripts?: PluginScriptMap;
  autorun?: readonly string[];
};

export type PluginShellId = 'nPlugins.sidebar.content';
export type PluginSurfaceId =
  | 'nPlugins.sidebar.content'
  | 'nPlugins.output.primary'
  | 'nPlugins.status.primary'
  | 'nPlugins.terminal.primary';

export type PluginShellMap = Partial<Record<PluginShellId, PluginShellDefinition>>;
export type PluginSurfaceMap = Partial<Record<PluginSurfaceId, PluginSurfaceDefinition>>;

export type PluginShellDefinition = PluginViewDefinition;
export type PluginSurfaceDefinition = PluginViewDefinition | PluginOutputSurfaceDefinition | PluginStatusSurfaceDefinition | PluginTerminalSurfaceDefinition;

export type PluginViewDefinition = PluginWebviewViewDefinition | PluginTreeViewDefinition;

export type PluginViewCommonDefinition = {
  title?: string;
};

export type PluginOutputSurfaceDefinition = {
  type: 'output';
  title?: string;
  html?: string;
  htmlFile?: string;
};

export type PluginStatusSurfaceDefinition = {
  type: 'status';
  title?: string;
  text: string;
  tooltip?: string;
  command?: string;
  alignment?: 'left' | 'right';
  priority?: number;
};

export type PluginTerminalSurfaceDefinition = {
  type: 'terminal';
  script?: string;
  title?: string;
};

export type PluginWebviewViewDefinition = PluginViewCommonDefinition & {
  type: 'webview';
  html?: string;
  htmlFile?: string;
};

export type PluginTreeViewDefinition = PluginViewCommonDefinition & {
  type: 'tree';
  items?: readonly PluginTreeViewItemDefinition[];
};

export type PluginTreeViewItemDefinition = {
  label: string;
  description?: string;
  tooltip?: string;
};

export type PluginScriptMap = Record<string, PluginScriptDefinition>;

export type PluginScriptDefinition = {
  command: string;
};
