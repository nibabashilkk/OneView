import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../lib/runtime";

export type ImportedEditorAsset = {
  path: string;
  relativePath: string;
  fileName: string;
};

export async function importEditorImagePath(documentPath: string, sourcePath: string): Promise<ImportedEditorAsset> {
  if (!isTauri()) throw new Error("浏览器预览无法导入本地图片");
  return invoke<ImportedEditorAsset>("import_editor_image_path", { documentPath, sourcePath });
}

export async function importEditorImageFile(documentPath: string, file: File): Promise<ImportedEditorAsset> {
  if (!isTauri()) throw new Error("浏览器预览无法写入图片");
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  const fileName = file.name || fallbackName(file.type);
  return invoke<ImportedEditorAsset>("import_editor_image_bytes", { documentPath, fileName, bytes });
}

function fallbackName(type: string) {
  const ext = type === "image/jpeg" ? "jpg" : type.split("/")[1]?.replace("svg+xml", "svg") || "png";
  return `pasted-image-${Date.now()}.${ext}`;
}

export function isImagePath(path: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(path);
}
