# v0.15.2 startup fix

## Symptom

`PluginInitialization("updater", "Error deserializing 'plugins.updater' ... invalid type: null, expected struct Config")`

## Root cause

The updater plugin is registered at application startup, but the base `tauri.conf.json` did not contain a `plugins.updater` object. Current `tauri-plugin-updater` deserializes its typed configuration during plugin initialization; a missing plugin entry arrives as `null` and cannot be deserialized as `Config`.

## Fix

The base config now contains a minimal valid object:

```json
"plugins": {
  "updater": {
    "pubkey": "",
    "endpoints": []
  }
}
```

This is initialization-only. The application still requires `MDV_UPDATE_ENDPOINT` and `MDV_UPDATE_PUBKEY` before `check_for_update` constructs the runtime updater, and the runtime builder overrides both values.
