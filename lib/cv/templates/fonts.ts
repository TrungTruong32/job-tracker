import { Font } from "@react-pdf/renderer"

let registered: string | null = null

/** Register Arimo (Arial/Helvetica metrics) and Tinos (Times metrics); both cover Vietnamese. */
export function registerFonts(base: string) {
  if (registered === base) return
  registered = base
  for (const family of ["Arimo", "Tinos"]) {
    Font.register({
      family,
      fonts: [
        { src: `${base}/${family}-Regular.ttf` },
        { src: `${base}/${family}-Bold.ttf`, fontWeight: 700 },
        { src: `${base}/${family}-Italic.ttf`, fontStyle: "italic" },
        { src: `${base}/${family}-BoldItalic.ttf`, fontWeight: 700, fontStyle: "italic" },
      ],
    })
  }
  // CVs read better without automatic hyphenation
  Font.registerHyphenationCallback((word) => [word])
}
