import { describe, expect, it } from "vitest";
import { deviceLabel } from "./deviceLabel";

describe("deviceLabel", () => {
  it.each([
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/147.0.7727.15 Safari/537.36", "Chrome · Linux"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", "Safari · macOS"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0", "Edge · Windows"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1", "Chrome · iPhone"],
    ["Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0", "Firefox · Android"],
    ["Chrome · Linux", "Chrome · Linux"],
    ["curl/8.0", "curl/8.0"],
    ["", ""],
  ])("%s", (agent, label) => expect(deviceLabel(agent)).toBe(label));

  it("trims an unknown agent to 80 characters", () => expect([...deviceLabel("x".repeat(200))]).toHaveLength(80));
});
