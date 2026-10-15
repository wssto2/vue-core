/**
 * Puts `text` on the clipboard and says whether it got there. The async clipboard needs a secure page; on any other (a local
 * address over plain HTTP) the old selection-and-copy still works, so a secret that cannot be shown again is not lost for want of a button.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through to the selection copy
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
