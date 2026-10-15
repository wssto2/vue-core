import { describe, expect, it } from "vitest";
import { filenameFromDisposition } from "./disposition";

describe("filenameFromDisposition", () => {
  it.each([
    ['attachment; filename="report.pdf"', "report.pdf"],
    ["attachment; filename=report.pdf", "report.pdf"],
    ['attachment; FILENAME = "report.pdf" ; size=3', "report.pdf"],
    ['attachment; filename="a;b.pdf"', "a;b.pdf"],
    ['attachment; filename="say \\"hi\\".txt"', 'say "hi".txt'],
    ["inline; filename=a.pdf; creation-date=x", "a.pdf"],
  ])("reads the plain name of %s", (header, expected) => {
    expect(filenameFromDisposition(header)).toBe(expected);
  });

  it("prefers filename* (UTF-8) over filename, whatever the order", () => {
    const star = "filename*=UTF-8''%C5%A1to%20%C4%87e.pdf";
    expect(filenameFromDisposition(`attachment; filename="sto ce.pdf"; ${star}`)).toBe("što će.pdf");
    expect(filenameFromDisposition(`attachment; ${star}; filename="sto ce.pdf"`)).toBe("što će.pdf");
  });

  it("decodes ISO-8859-1 and skips a language tag", () => {
    expect(filenameFromDisposition("attachment; filename*=iso-8859-1'en'%E9t%E9.txt")).toBe("été.txt");
    expect(filenameFromDisposition("attachment; filename*=UTF-8'hr'a%20b.txt")).toBe("a b.txt");
  });

  it("falls back to filename when filename* is not decodable", () => {
    expect(filenameFromDisposition("attachment; filename*=UTF-8''%FF%FE; filename=\"ok.txt\"")).toBe("ok.txt");
    expect(filenameFromDisposition("attachment; filename*=klingon''x; filename=ok.txt")).toBe("ok.txt");
    expect(filenameFromDisposition("attachment; filename*=nonsense; filename=ok.txt")).toBe("ok.txt");
  });

  it("drops a directory part", () => {
    expect(filenameFromDisposition('attachment; filename="../../etc/passwd"')).toBe("passwd");
    expect(filenameFromDisposition('attachment; filename="C:\\\\tmp\\\\a.pdf"')).toBe("a.pdf");
  });

  it.each([null, "", "attachment", "inline", 'attachment; filename=""', "attachment; name=x"])("is null when %j proposes no name", (header) => {
    expect(filenameFromDisposition(header)).toBeNull();
  });
});
