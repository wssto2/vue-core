export type FileProblem = "invalid_type" | "too_large";

/**
 * Whether a file is acceptable: a stable problem key, or null. `accept` entries are extensions (".pdf"), MIME
 * types ("image/png") or MIME families ("image/*"); an empty list allows any type. `maxSize` is in bytes; 0 allows any size.
 */
export function checkFile(file: { readonly name: string; readonly type: string; readonly size: number }, options: { accept?: readonly string[]; maxSize?: number } = {}): FileProblem | null {
  const accept = options.accept ?? [];
  if (accept.length > 0) {
    const dot = file.name.lastIndexOf(".");
    const extension = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
    const type = file.type.toLowerCase();
    const allowed = accept.some((entry) => {
      const each = entry.trim().toLowerCase();
      if (each.startsWith(".")) return each === extension;
      if (each.endsWith("/*")) return type.startsWith(each.slice(0, -1));
      return each === type;
    });
    if (!allowed) return "invalid_type";
  }
  if ((options.maxSize ?? 0) > 0 && file.size > (options.maxSize ?? 0)) return "too_large";
  return null;
}

/** "512 B", "24 KB", "5 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}
