/**
 * A URL-fragment slug for a human title: "Stanje i boja" gives "stanje-i-boja", "Karakteristike
 * vozila" gives "karakteristike-vozila". Diacritics are folded (č ć š ž đ become c c s z d), so
 * links stay readable and copy-paste safe; what is left of nothing is the empty string.
 *
 *   <section :id="slugify(group.title)">   // linked as #stanje-i-boja
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
