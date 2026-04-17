# nPlugins

Workspace plugin host for VS Code.

`nPlugins` discovers plugin manifests from the workspace, exposes their registered surfaces in VS Code, and manages plugin scripts with autorun support.

## What It Does

- Loads `plugins.json` from each workspace folder.
- Resolves each plugin's `plugin.json` or `plugin.config.json`.
- Renders plugin-provided content into the `nPlugins` activity bar container.
- Registers output, status bar, and terminal surfaces from plugin manifests.
- Starts declared `autorun` scripts in named VS Code terminals.
- Reassociates to existing named terminals after window reload or extension host restart.

## Workspace Registry

Each workspace folder can define a top-level `plugins.json` file:

```json
{
	"plugins": [
		{
			"source": {
				"packageRoot": "./pluginBoilerplate"
			}
		},
		{
			"source": {
				"packageRoot": "./vscodeHostHarness",
				"config": "plugin.config.json"
			}
		}
	]
}
```

Notes:

- `source.packageRoot` is required.
- `source.config` is optional.
- If `config` is omitted, resolution prefers `plugin.json`, then falls back to `plugin.config.json`.
- The plugin id comes from the manifest, not from `plugins.json`.

## Plugin Manifest

Minimal shape:

```json
{
	"id": "pluginBoilerplate",
	"registrations": {
		"shells": {},
		"surfaces": {}
	},
	"scripts": {},
	"autorun": []
}
```

Supported fields:

- `id`: unique plugin id.
- `registrations.shells`: content registered into host-owned shell slots.
- `registrations.surfaces`: output/status/terminal surface registrations.
- `scripts`: named commands runnable by the host.
- `autorun`: script names to start automatically on activation.

## Supported Shells And Surfaces

Shell ids:

- `nPlugins.sidebar.content`

Surface ids:

- `nPlugins.sidebar.content`
- `nPlugins.output.primary`
- `nPlugins.status.primary`
- `nPlugins.terminal.primary`

Definition types:

- `webview`
- `tree`
- `output`
- `status`
- `terminal`

Example manifest:

```json
{
	"id": "pluginBoilerplate",
	"registrations": {
		"shells": {
			"nPlugins.sidebar.content": {
				"type": "webview",
				"title": "Plugin Boilerplate",
				"htmlFile": "src/plugin-sidebar.html"
			}
		},
		"surfaces": {
			"nPlugins.output.primary": {
				"type": "output",
				"title": "Plugin Boilerplate Output",
				"htmlFile": "src/plugin-sidebar.html"
			},
			"nPlugins.status.primary": {
				"type": "status",
				"text": "$(plug) pluginBoilerplate",
				"tooltip": "pluginBoilerplate registered status content",
				"alignment": "right",
				"priority": 100
			},
			"nPlugins.terminal.primary": {
				"type": "terminal",
				"title": "Plugin Boilerplate Terminal",
				"script": "server"
			}
		}
	},
	"scripts": {
		"server": {
			"command": "bun run server.ts"
		}
	},
	"autorun": ["server"]
}
```

## Lifecycle

On activation, `nPlugins`:

1. Reads all workspace plugin registry entries.
2. Loads manifests.
3. Registers shell and surface content.
4. Starts each plugin listed in the registry.
5. Starts each manifest `autorun` script.

Autorun scripts are terminal-backed and process-aware:

- A fresh run creates a terminal named `<pluginId>:<scriptName>`.
- If VS Code restores that terminal after a reload, `nPlugins` reuses it instead of starting another copy.
- Stopping a plugin from the `nPlugins` UI stops host ownership of the script runtime.
- Reload-driven extension disposal does not kill reused restored terminals, allowing reassociation on the next activation.

## Commands

- `nPlugins: Open Sidebar`
- `nPlugins: Refresh Plugins`
- `nPlugins: Start Plugin`
- `nPlugins: Stop Plugin`
- `nPlugins: Run Plugin Script`

## UI

The extension contributes an `nPlugins` activity bar container with:

- `Plugins`: tree of discovered plugins and script status.
- `Plugin Content`: tabbed webview for content registered to `nPlugins.sidebar.content`.

Additional plugin content can appear in:

- output channels
- status bar items
- managed terminals

## Development

From this package directory:

```bash
npm install
npm run compile
```

Available scripts:

- `npm run compile`
- `npm run watch`
- `npm run clean`
- `npm run package:vsix`

## Authoring Guidance

- Keep plugin ids stable; terminal reassociation depends on the `<pluginId>:<scriptName>` name.
- Use `autorun` only for long-lived scripts that should survive reloads when VS Code restores the terminal.
- Put UI HTML in files when possible using `htmlFile` instead of large inline strings.
- Treat terminal surfaces as registration metadata; script process ownership lives in `scripts` and `autorun`.

## Current Limitations

- Plugin manifests are loaded from disk on refresh; there is no file watching yet.
- Script health is inferred from terminal association, not process inspection.
- Terminal surface registration currently opens a host terminal placeholder, not a full process supervisor.
