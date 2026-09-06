import { effectivePluginRuntimeKind, type PluginManifest, type PluginPermission } from "../domain/plugin";

/** Single authority for host-side capability checks. Sandbox-side API shaping is defense in depth only. */
export class PluginPermissionGuard {
  constructor(private readonly manifest: PluginManifest) {}

  require(permission: PluginPermission) {
    if (effectivePluginRuntimeKind(this.manifest) !== "extension") {
      throw new Error(`Document Runtime 不开放权限：${permission}`);
    }
    if (!this.manifest.permissions.includes(permission)) {
      throw new Error(`插件未声明权限：${permission}`);
    }
  }
}
