import { daysSince, type AppLite, type StageLite } from "@/lib/domain"

export type TodoItem = {
  app: AppLite
  reason: "due" | "stale"
  daysOver: number
  severity: "warn" | "danger"
}

const DANGER_AFTER_DAYS = 3

/**
 * Apps that need attention today: next action due (today or earlier), or an
 * active app with no activity for more than `staleDays`. Most overdue first.
 */
export function getTodayItems(apps: AppLite[], stages: StageLite[], staleDays: number, today: Date): TodoItem[] {
  const kindById = new Map(stages.map((s) => [s.id, s.kind]))
  const items: TodoItem[] = []

  for (const app of apps) {
    if (app.next_action_due) {
      const over = daysSince(app.next_action_due, today)
      if (over >= 0) {
        items.push({ app, reason: "due", daysOver: over, severity: over > DANGER_AFTER_DAYS ? "danger" : "warn" })
        continue
      }
    }
    if (kindById.get(app.stage_id) !== "active") continue
    const over = daysSince(app.last_activity_at, today) - staleDays
    if (over > 0) {
      items.push({ app, reason: "stale", daysOver: over, severity: over > DANGER_AFTER_DAYS ? "danger" : "warn" })
    }
  }

  return items.sort((a, b) => b.daysOver - a.daysOver)
}
