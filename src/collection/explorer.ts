/** What a `FileExplorer` row is: a folder, a page, a link or a file; the app's rows carry whatever else the columns show. */
export interface ExplorerRow {
  readonly id: string | number;
  readonly kind: "folder" | "page" | "link" | "file";
  readonly name: string;
}

/** One step of a `FileExplorer` breadcrumb: the folder's id (`null`: the root) and its name. */
export interface ExplorerCrumb {
  readonly id: string | null;
  readonly label: string;
}
