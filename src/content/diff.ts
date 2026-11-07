/** One line of a diff: unchanged (`" "`), removed (`"-"`) or added (`"+"`). */
export interface DiffLine {
  op: " " | "-" | "+";
  text: string;
}

/** A line with its numbers in the old and in the new text (a removed line has no new number, an added line no old one). */
export interface NumberedLine extends DiffLine {
  oldNo: number | null;
  newNo: number | null;
}

/** A run of unchanged lines folded away; `lines` are what a click shows. `key` is the index of its first line. */
export interface DiffGap {
  gap: true;
  key: number;
  lines: NumberedLine[];
}

export type DiffRow = NumberedLine | DiffGap;
export const isGap = (row: object): row is DiffGap => "gap" in row;

/** The unified rows: every line numbered, and each run of unchanged lines farther than `context` lines from a change folded into a gap (`context: null` folds nothing). A run of one line is not worth a gap. */
export function diffRows(lines: readonly DiffLine[], context: number | null, expanded: ReadonlySet<number> = new Set()): DiffRow[] {
  let oldNo = 0;
  let newNo = 0;
  const numbered = lines.map((line): NumberedLine => ({
    ...line,
    oldNo: line.op === "+" ? null : ++oldNo,
    newNo: line.op === "-" ? null : ++newNo,
  }));
  if (context === null) return numbered;

  const near = new Array<boolean>(numbered.length).fill(false);
  numbered.forEach((line, index) => {
    if (line.op === " ") return;
    for (let at = Math.max(0, index - context); at <= Math.min(numbered.length - 1, index + context); at++) near[at] = true;
  });
  const rows: DiffRow[] = [];
  let index = 0;
  while (index < numbered.length) {
    if (near[index]) {
      rows.push(numbered[index++]!);
      continue;
    }
    const start = index;
    while (index < numbered.length && !near[index]) index++;
    const run = numbered.slice(start, index);
    if (run.length < 2 || expanded.has(start)) rows.push(...run);
    else rows.push({ gap: true, key: start, lines: run });
  }
  return rows;
}

/** Two columns of the split view; a side without a line is null (the other side changed alone). */
export type SplitRow = { left: NumberedLine | null; right: NumberedLine | null } | DiffGap;

/** The rows side by side: a run of removed lines meets the added lines that follow it, one for one. */
export function splitRows(rows: readonly DiffRow[]): SplitRow[] {
  const out: SplitRow[] = [];
  let removed: NumberedLine[] = [];
  let added: NumberedLine[] = [];
  const flush = () => {
    for (let at = 0; at < Math.max(removed.length, added.length); at++) out.push({ left: removed[at] ?? null, right: added[at] ?? null });
    removed = [];
    added = [];
  };
  for (const row of rows) {
    if (!isGap(row) && row.op === "-") removed.push(row);
    else if (!isGap(row) && row.op === "+") added.push(row);
    else {
      flush();
      out.push(isGap(row) ? row : { left: row, right: row });
    }
  }
  flush();
  return out;
}
