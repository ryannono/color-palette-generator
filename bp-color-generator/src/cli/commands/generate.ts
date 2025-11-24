/**
 * Generate command for palette generation
 *
 * Uses @effect/cli for command structure and argument parsing
 */

import { Command, Options } from "@effect/cli"
import { Effect } from "effect"
import { StopPositionSchema } from "src/schemas/palette.js"
import { generatePalette } from "../../programs/generate-palette.js"
import { ColorSpaceSchema, ColorStringSchema } from "../../schemas/color.js"
import { GeneratePaletteInput } from "../../schemas/generate-palette.js"

/**
 * Color input option
 */
const colorOption = Options.text("color").pipe(
  Options.withAlias("c"),
  Options.withSchema(ColorStringSchema),
  Options.withDescription("Input color (hex, rgb(), hsl(), oklch(), etc.)")
)

/**
 * Stop position option
 */
const stopOption = Options.integer("stop").pipe(
  Options.withAlias("s"),
  Options.withSchema(StopPositionSchema),
  Options.withDescription("Stop position (100-1000)")
)

/**
 * Output format option
 */
const formatOption = Options.text("format").pipe(
  Options.withAlias("f"),
  Options.withDefault("hex"),
  Options.withSchema(ColorSpaceSchema),
  Options.withDescription("Output format: hex, rgb, oklch, oklab")
)

/**
 * Palette name option
 */
const nameOption = Options.text("name").pipe(
  Options.withAlias("n"),
  Options.withDefault("generated"),
  Options.withDescription("Palette name")
)

/**
 * Pattern source option (for advanced users)
 */
const patternOption = Options.text("pattern").pipe(
  Options.withAlias("p"),
  Options.withDefault("test/fixtures/palettes/example-blue.json"),
  Options.withDescription("Pattern source file path")
)

/**
 * Generate command
 */
export const generate = Command.make(
  "generate",
  {
    color: colorOption,
    format: formatOption,
    name: nameOption,
    pattern: patternOption,
    stop: stopOption
  }
).pipe(
  Command.withHandler(
    ({ color, format, name, pattern, stop }) =>
      Effect.gen(function*() {
        // Validate and create input using schema
        const input = yield* GeneratePaletteInput({
          anchorStop: stop,
          inputColor: color,
          outputFormat: format,
          paletteName: name,
          patternSource: pattern
        })

        // Generate palette
        const result = yield* generatePalette(input)

        // Format and display output
        yield* Effect.sync(() => {
          console.log(`\n🎨 Generated Palette: ${result.name}`)
          console.log(`   Input: ${result.inputColor} at stop ${result.anchorStop}`)
          console.log(`   Format: ${result.outputFormat}\n`)

          for (const stop of result.stops) {
            console.log(`   ${stop.position}: ${stop.value}`)
          }
          console.log()
        })

        return result
      })
  ),
  Command.withDescription("Generate a color palette from a single color")
)
