const MAX = 80;

const browserOf = (ua: string): string => {
  if (/Edg\/|EdgA\/|EdgiOS\//.test(ua)) return "Edge";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\/|iPhone|iPad/.test(ua)) return "Safari"; // a home-screen web app on iPhone sends no Safari/ token
  return "";
};

const systemOf = (ua: string): string => {
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Windows")) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux|X11/.test(ua)) return "Linux";
  return "";
};

/**
 * "Browser · OS" from a User-Agent, as go-core names a session's device (`account.DeviceLabel`): Chrome, Safari, Edge or
 * Firefox on macOS, Windows, iPhone, iPad, Android or Linux; anything else is the raw string, trimmed to 80 characters.
 * Sign-in rows carry the raw User-Agent (go-core labels only sessions), so the screens that list them label it here; a
 * string that already is a label comes out unchanged.
 */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent.trim();
  if (ua === "") return "";
  const browser = browserOf(ua);
  const system = systemOf(ua);
  return browser && system ? `${browser} · ${system}` : [...ua].slice(0, MAX).join("");
}
