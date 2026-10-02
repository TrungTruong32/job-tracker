import { AiError, type AiErrorKind } from "./client"

export type ChainEntryRef = { connectionId: string; model: string }
export type ChainFailure = { index: number; model: string; kind: AiErrorKind; message: string }
export type ChainResult<T> = { data: T; index: number; model: string; failures: ChainFailure[] }

export class ChainError extends Error {
  constructor(public failures: ChainFailure[]) {
    super(
      failures.length
        ? "Tất cả model đều lỗi:\n" + failures.map((f) => `#${f.index + 1} ${f.model}: ${f.message}`).join("\n")
        : "Chưa cấu hình model AI. Vào Cài đặt → AI để thêm kết nối và chọn model.",
    )
    this.name = "ChainError"
  }
}

/**
 * Try each model in order. A wrong key (auth) skips the rest of that connection;
 * any other failure moves on to the next entry.
 */
export async function runChain<T>(
  entries: ChainEntryRef[],
  attempt: (entry: ChainEntryRef, index: number) => Promise<T>,
): Promise<ChainResult<T>> {
  const failures: ChainFailure[] = []
  const deadConnections = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (deadConnections.has(entry.connectionId)) continue
    try {
      return { data: await attempt(entry, index), index, model: entry.model, failures }
    } catch (e) {
      const kind: AiErrorKind = e instanceof AiError ? e.kind : "unknown"
      if (kind === "input") throw e
      failures.push({ index, model: entry.model, kind, message: e instanceof Error ? e.message : String(e) })
      if (kind === "auth") deadConnections.add(entry.connectionId)
    }
  }
  throw new ChainError(failures)
}
