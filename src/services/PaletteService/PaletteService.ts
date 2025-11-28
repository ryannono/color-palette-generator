/**
 * Palette service for color palette generation
 *
 * Orchestrates PatternService and ConfigService to generate complete palettes
 * with support for single and batch generation.
 */

import { Array, Data, Effect, Either, Layer, Schema } from "effect"
import type { ParseError } from "effect/ParseResult"
import { ColorError, oklchToHex, oklchToOKLAB, oklchToRGB, parseColorStringToOKLCH } from "../../domain/color/color.js"
import type { ColorSpace, OKLABColor, OKLCHColor, RGBColor } from "../../domain/color/color.schema.js"
import { generatePaletteFromStop } from "../../domain/palette/generator.js"
import { ConfigService } from "../ConfigService.js"
import { FilePath } from "../PatternService/filesystem.schema.js"
import { PatternService } from "../PatternService/index.js"
import {
  type BatchRequest,
  type BatchResult,
  ISOTimestampSchema,
  type PaletteRequest,
  PaletteResult
} from "./palette.schema.js"

// ============================================================================
// Errors
// ============================================================================

/**
 * Error when palette generation fails
 *
 * Wraps underlying errors from color parsing, pattern loading, or palette generation.
 */
export class PaletteGenerationError extends Data.TaggedError(
  "PaletteGenerationError"
)<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ============================================================================
// Service
// ============================================================================

/**
 * Palette service using Effect.Service pattern
 *
 * Provides palette generation capabilities with dependency injection for
 * PatternService and ConfigService.
 */
export class PaletteService extends Effect.Service<PaletteService>()(
  "PaletteService",
  {
    effect: Effect.gen(function*() {
      const patternService = yield* PatternService
      const configService = yield* ConfigService

      /**
       * Generate a single palette from an input color and anchor stop
       *
       * Steps:
       * 1. Parse input color string to OKLCH
       * 2. Load transformation pattern (from input override or config)
       * 3. Generate palette using pattern
       * 4. Convert all stops to requested output format
       * 5. Validate and return formatted result
       */
      const generate = (
        input: PaletteRequest
      ): Effect.Effect<PaletteResult, PaletteGenerationError> =>
        Effect.gen(function*() {
          const { anchorStop, inputColor, outputFormat, paletteName } = input

          const config = yield* configService.getConfig()
          const patternSource = input.patternSource
            ? yield* FilePath(input.patternSource).pipe(
              Effect.mapError(
                (error) =>
                  new PaletteGenerationError({
                    message: `Invalid pattern source: ${input.patternSource}`,
                    cause: error
                  })
              )
            )
            : config.patternSource

          const oklchColor = yield* parseColorStringToOKLCH(inputColor)
          const pattern = yield* patternService.loadPattern(patternSource)
          const palette = yield* generatePaletteFromStop(
            oklchColor,
            anchorStop,
            pattern,
            paletteName
          )

          const formattedStops = yield* Effect.forEach(
            palette.stops,
            (stop) =>
              convertColor(stop.color, outputFormat).pipe(
                Effect.map((formatted) => ({
                  color: stop.color,
                  position: stop.position,
                  value: formatted
                }))
              ),
            { concurrency: "unbounded" }
          )

          return yield* PaletteResult({
            anchorStop,
            inputColor,
            name: palette.name,
            outputFormat,
            stops: formattedStops
          })
        }).pipe(
          Effect.mapError(
            (error) =>
              new PaletteGenerationError({
                message: `Failed to generate palette for ${input.inputColor}`,
                cause: error
              })
          )
        )

      /**
       * Generate multiple palettes in batch with partial success support
       *
       * Generates palettes in parallel. Individual failures don't stop the batch -
       * successful palettes are returned with a partial flag indicating if any failed.
       */
      const generateBatch = (
        input: BatchRequest
      ): Effect.Effect<BatchResult, never> =>
        Effect.gen(function*() {
          const results = yield* Effect.forEach(
            input.pairs,
            ({ color, stop }) =>
              Effect.either(
                generate({
                  inputColor: color,
                  anchorStop: stop,
                  outputFormat: input.outputFormat,
                  paletteName: `${input.paletteGroupName}-${color}`,
                  patternSource: input.patternSource
                })
              ),
            { concurrency: "unbounded" }
          )

          const palettes = Array.getSomes(results.map(Either.getRight))

          const generatedAt = yield* Effect.clockWith((clock) =>
            clock.currentTimeMillis.pipe(
              Effect.map((millis) => Schema.decodeSync(ISOTimestampSchema)(new Date(millis).toISOString()))
            )
          )

          return {
            groupName: input.paletteGroupName,
            outputFormat: input.outputFormat,
            palettes,
            partial: palettes.length < results.length,
            generatedAt
          }
        })

      return {
        generate,
        generateBatch
      }
    }),
    dependencies: [PatternService.Default, ConfigService.Default]
  }
) {
  /**
   * Test layer with test dependencies
   *
   * Uses ConfigService.Test and PatternService.Test for predictable test behavior.
   */
  static readonly Test = PaletteService.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.mergeAll(PatternService.Test, ConfigService.Test))
  )
}

// ============================================================================
// Color Formatting Helpers
// ============================================================================

/** Format RGB color as CSS rgb() string */
const formatRGB = (rgb: RGBColor): string =>
  `rgb(${rgb.r}, ${rgb.g}, ${rgb.b}${rgb.alpha !== 1 ? `, ${rgb.alpha}` : ""})`

/** Format OKLCH color as CSS oklch() string */
const formatOKLCH = (color: OKLCHColor): string =>
  `oklch(${(color.l * 100).toFixed(2)}% ${color.c.toFixed(3)} ${
    color.h.toFixed(
      1
    )
  }${color.alpha !== 1 ? ` / ${color.alpha}` : ""})`

/** Format OKLAB color as CSS oklab() string */
const formatOKLAB = (oklab: OKLABColor): string =>
  `oklab(${(oklab.l * 100).toFixed(2)}% ${oklab.a.toFixed(3)} ${
    oklab.b.toFixed(
      3
    )
  }${oklab.alpha !== 1 ? ` / ${oklab.alpha}` : ""})`

/** Color converter function type */
type ColorConverter = (
  color: OKLCHColor
) => Effect.Effect<string, ColorError | ParseError>

/** Color format converters lookup table */
const colorConverters: Record<ColorSpace, ColorConverter> = {
  hex: oklchToHex,
  rgb: (color) => oklchToRGB(color).pipe(Effect.map(formatRGB)),
  oklch: (color) => Effect.succeed(formatOKLCH(color)),
  oklab: (color) => oklchToOKLAB(color).pipe(Effect.map(formatOKLAB))
}

/** Convert OKLCH color to requested output format as CSS string */
const convertColor = (
  color: OKLCHColor,
  format: ColorSpace
): Effect.Effect<string, ColorError | ParseError> => colorConverters[format](color)
