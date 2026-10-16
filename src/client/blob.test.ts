import { afterEach, describe, expect, it, vi } from "vitest";
import { openBlob, saveBlob } from "./blob";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("saveBlob and openBlob", () => {
  it("saves under the given name and frees the blob at once", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:a");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let saved: { href: string; download: string } | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved = { href: this.href, download: this.download };
    });
    saveBlob(new Blob(["%PDF"]), "ugovor-č.pdf");
    expect(saved).toEqual({ href: "blob:a", download: "ugovor-č.pdf" });
    expect(revoke).toHaveBeenCalledWith("blob:a");
  });

  it("opens a new tab without an opener and frees the blob after a minute", () => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:b");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    openBlob(new Blob(["%PDF"]));
    expect(open).toHaveBeenCalledWith("blob:b", "_blank", "noopener,noreferrer");
    vi.advanceTimersByTime(59_999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith("blob:b");
  });
});
