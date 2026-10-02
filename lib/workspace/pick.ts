export type WorkspaceRole = "owner" | "member"
export type WorkspaceLite = { id: string; name: string; role: WorkspaceRole }

/** The workspace to show: the remembered one if still a member, else an owned one, else the first. */
export function pickWorkspace<T extends WorkspaceLite>(list: T[], remembered: string | undefined): T | null {
  return list.find((w) => w.id === remembered) ?? list.find((w) => w.role === "owner") ?? list[0] ?? null
}
