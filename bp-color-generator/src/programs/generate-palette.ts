/**
 * Main palette generation program
 *
 * Orchestrates the complete pipeline:
 * 1. Parse and validate input color
 * 2. Load and extract patterns from example palettes
 * 3. Generate palette from anchor stop
 * 4. Convert to requested output format
 */

import { Effect } from "effect"
import type { ParseError } from "effect/ParseResult"
import { oklchToHex, oklchToOKLAB, oklchToRGB } from "../domain/color/conversions.js"
import { ColorConversionError } from "../domain/color/errors.js"
import { smoothPattern } from "../domain/math/interpolation.js"
import { generatePaletteFromStop } from "../domain/palette/generator.js"
import type { ColorSpace } from "../schemas/color.js"
import { parseColorStringToOKLCH } from "../schemas/color.js"
import { GeneratedPaletteOutput, type GeneratePaletteInput } from "../schemas/generate-palette.js"
import type { Palette } from "../schemas/palette.js"
import { learnFromSinglePalette } from "./learn-patterns.js"

/**
 * Generate a palette from a color string at a specific stop position
 */
export const generatePalette = (
  input: GeneratePaletteInput
): Effect.Effect<GeneratedPaletteOutput, ColorConversionError | ParseError | Error> =>
  Effect.gen(function*() {
    const { anchorStop, inputColor, outputFormat, paletteName, patternSource } = input
    // Step 1: Parse input color to OKLCH
    const oklchColor = yield* parseColorStringToOKLCH(inputColor)

    // Step 2: Learn and smooth pattern from example palette
    const { pattern } = yield* learnFromSinglePalette(patternSource)
    const smoothed = smoothPattern(pattern)

    // Step 3: Generate palette
    const palette = yield* generatePaletteFromStop(
      oklchColor,
      anchorStop,
      smoothed,
      paletteName
    )

    // Step 4: Convert to requested output format
    const formattedStops = yield* Effect.forEach(
      palette.stops,
      (stop) =>
        Effect.gen(function*() {
          const formatted = yield* convertColor(stop.color, outputFormat)
          return {
            color: stop.color,
            position: stop.position,
            value: formatted
          }
        }),
      { concurrency: "unbounded" }
    )

    // Step 5: Validate output with schema decoder
    return yield* GeneratedPaletteOutput({
      anchorStop,
      inputColor,
      name: palette.name,
      outputFormat,
      stops: formattedStops
    })
  })

/**
 * Convert OKLCH color to requested format
 */
const convertColor = (
  color: Palette["stops"][number]["color"],
  format: ColorSpace
): Effect.Effect<string, ColorConversionError | ParseError> => {
  switch (format) {
    case "hex":
      return oklchToHex(color)
    case "rgb":
      return Effect.map(
        oklchToRGB(color),
        (rgb) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b}${rgb.alpha !== 1 ? `, ${rgb.alpha}` : ""})`
      )
    case "oklch":
      return Effect.succeed(
        `oklch(${(color.l * 100).toFixed(2)}% ${color.c.toFixed(3)} ${color.h.toFixed(1)}${
          color.alpha !== 1 ? ` / ${color.alpha}` : ""
        })`
      )
    case "oklab":
      return Effect.map(
        oklchToOKLAB(color),
        (oklab) =>
          `oklab(${(oklab.l * 100).toFixed(2)}% ${oklab.a.toFixed(3)} ${oklab.b.toFixed(3)}${
            oklab.alpha !== 1 ? ` / ${oklab.alpha}` : ""
          })`
      )
  }
}
