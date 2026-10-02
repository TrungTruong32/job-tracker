import { z } from "zod"
import { SECTION_KEYS } from "@/lib/profile/schema"
import { TEMPLATE_KEYS } from "./templates/registry"

export const CvSectionKeySchema = z.enum(["summary", ...SECTION_KEYS])

export const CvContentSchema = z.object({
  sections: z
    .array(
      z.object({
        key: CvSectionKeySchema,
        title: z.string().max(60).optional(),
        visible: z.boolean().default(true),
        items: z
          .array(
            z.object({
              item_id: z.string().min(1),
              bullet_ids: z.array(z.string()).max(60).nullable().optional(),
              overrides: z.record(z.string(), z.string().max(500)).optional(),
              bullet_overrides: z.record(z.string(), z.string().max(1000)).optional(),
            }),
          )
          .max(200),
      }),
    )
    .max(20),
  summary_override: z.string().max(3000).optional(),
})

export const CvStyleSchema = z.object({
  font_size: z.number().min(7).max(14),
  line_height: z.number().min(0.9).max(2),
  margin_mm: z.number().min(5).max(30),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  date_format: z.enum(["MMMM YYYY", "MMM YYYY", "MM/YYYY", "YYYY"]),
  show_qr: z.boolean(),
  qr_url: z.string().max(500).optional(),
})

export const TemplateKeySchema = z.enum(TEMPLATE_KEYS as [string, ...string[]])
