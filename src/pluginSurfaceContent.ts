import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  PluginOutputSurfaceDefinition,
  PluginShellDefinition,
  PluginSurfaceDefinition,
  PluginSurfaceId,
  PluginStatusSurfaceDefinition,
  PluginTerminalSurfaceDefinition,
  PluginTreeViewDefinition,
  PluginViewDefinition,
  PluginWebviewViewDefinition,
} from './pluginManifest.js';
import type { StartupPluginRegistryEntry } from './pluginRegistry.js';

export type SurfaceRegistration<TDefinition extends PluginSurfaceDefinition | PluginShellDefinition> = {
  entry: StartupPluginRegistryEntry;
  surfaceId: string;
  definition: TDefinition;
};

export function getShellRegistrations(
  entries: readonly StartupPluginRegistryEntry[],
  shellId: string,
): SurfaceRegistration<PluginShellDefinition>[] {
  return entries.flatMap((entry) =>
    Object.entries(entry.config.registrations?.shells ?? {})
      .filter(([candidateId]) => candidateId === shellId)
      .map(([surfaceId, definition]) => ({
        entry,
        surfaceId,
        definition: definition as PluginShellDefinition,
      })),
  );
}

export function getSurfaceRegistrations(
  entries: readonly StartupPluginRegistryEntry[],
  surfaceId: PluginSurfaceId,
): SurfaceRegistration<PluginSurfaceDefinition>[] {
  return entries.flatMap((entry) =>
    Object.entries(entry.config.registrations?.surfaces ?? {})
      .filter(([candidateId]) => candidateId === surfaceId)
      .map(([id, definition]) => ({
        entry,
        surfaceId: id,
        definition: definition as PluginSurfaceDefinition,
      })),
  );
}

export function resolveHtmlLikeContent(
  entry: StartupPluginRegistryEntry,
  surfaceId: string,
  definition: PluginWebviewViewDefinition | PluginOutputSurfaceDefinition,
): string {
  if (typeof definition.html === 'string' && definition.html.length > 0) {
    return definition.html;
  }

  if (typeof definition.htmlFile === 'string' && definition.htmlFile.length > 0) {
    const htmlPath = path.resolve(entry.packageRoot, definition.htmlFile);
    try {
      return fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      return `Failed to load HTML from ${htmlPath}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return `Plugin ${entry.config.id} registered content for ${surfaceId}, but no html or htmlFile was provided.`;
}

export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return text.length > 0 ? text : ['(empty html)'];
}

export function getDisplayTitle(
  entry: StartupPluginRegistryEntry,
  definition: PluginViewDefinition | PluginOutputSurfaceDefinition | PluginStatusSurfaceDefinition | PluginTerminalSurfaceDefinition,
): string {
  return definition.title ?? entry.config.id;
}

export function isTreeDefinition(definition: PluginShellDefinition): definition is PluginTreeViewDefinition {
  return definition.type === 'tree';
}
