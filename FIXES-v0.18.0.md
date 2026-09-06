# v0.18.0 Plugin System Foundation

This release turns the previous source-level extension points into an installable plugin subsystem.

Key boundaries:

- `.mdvplugin` package management and plugin-scoped storage are owned by Rust `PluginService`.
- `PluginManager` is the application-level lifecycle facade.
- `PluginRepository` is the persistence/IPC port.
- `WorkerPluginRuntime` is the isolated execution adapter.
- Plugins contribute commands through a stable DTO and never receive the app's command registry, Svelte stores, ProseMirror view or Tauri invoke handle.

Plugin API v1 is intentionally narrow. Additional capabilities should be added as explicit ports with explicit permissions rather than by exposing internal objects.
