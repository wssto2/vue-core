/** `name=value` pairs of a header value: a value is a quoted string (backslash escapes) or a token up to the next `;`. */
const PARAMETER = /;\s*([^\s=;]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^;]*)/g;

/** RFC 8187 `charset'language'percent-encoded`; null when the charset is unknown or the bytes are not valid in it. */
function decodeExtended(value: string): string | null {
  const parts = /^([^']*)'[^']*'(.*)$/s.exec(value);
  if (!parts) return null;
  const encoder = new TextEncoder();
  const bytes: number[] = [];
  for (const [, hex, char] of parts[2]!.matchAll(/%([0-9a-f]{2})|(.)/gis)) bytes.push(...(hex ? [parseInt(hex, 16)] : encoder.encode(char)));
  try {
    return new TextDecoder(parts[1] || "utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

/** The proposed file name without a directory part (RFC 6266 §4.3: a name is never a path). */
const base = (name: string) => name.slice(Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1).trim();

/**
 * The file name of a `Content-Disposition` header (RFC 6266): `filename*=` (RFC 8187, UTF-8 or ISO-8859-1) wins over
 * `filename=`, quotes and backslash escapes are handled, a directory part is dropped. Null when the header has no usable name.
 */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  let plain: string | null = null;
  let extended: string | null = null;
  for (const [, rawName, rawValue] of header.replace(/^[^;]*/, "").matchAll(PARAMETER)) {
    const name = rawName!.toLowerCase();
    if (name !== "filename" && name !== "filename*") continue;
    const quoted = rawValue!.startsWith('"');
    const value = quoted ? rawValue!.slice(1, -1).replace(/\\(.)/g, "$1") : rawValue!.trim();
    if (name === "filename*") extended ??= decodeExtended(value);
    else plain ??= value;
  }
  return base(extended ?? plain ?? "") || null;
}
