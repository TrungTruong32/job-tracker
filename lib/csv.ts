type Cell = string | number | null | undefined

function cell(v: Cell): string {
  if (v === null || v === undefined) return ""
  let s = String(v)
  if (/^[=+\-@]/.test(s)) s = "'" + s // stop Excel/Sheets from running formulas
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV with a UTF-8 BOM so Excel shows Vietnamese correctly. */
export function toCsv(header: string[], rows: Cell[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")
}
