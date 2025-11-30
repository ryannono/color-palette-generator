/**
 * Palette service for color palette generation with pattern-based transformations.
 */

import { Array, Data, Effect, Either, Layer, Option as O, Schema } from "effect"
import { parseColorStringToOKLCH } from "../../domain/color/color.js"
import { formatPaletteStops } from "../../domain/color/formatter.js"
import { generatePaletteFromStop } from "../../domain/palette/generator.js"
import {
  type BatchResult,
  type GenerationFailure,
  ISOTimestampSchema,
  PaletteResult
} from "../../domain/palette/palette.schema.js"
import { ConfigService } from "../ConfigService.js"
import { FilePath, type FilePath as FilePathType } from "../PatternService/filesystem.schema.js"
import { PatternService } from "../PatternService/index.js"
import { type BatchRequest, type PaletteRequest } from "./palette.schema.js"

// ============================================================================
// Errors
// ============================================================================

/** Wraps underlying errors from color parsing, pattern loading, or palette generation. */
export class PaletteGenerationError extends Data.TaggedError(
  "PaletteGenerationError"
)<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Extract a human-readable message from an error, including nested causes */
const extractErrorMessage = (error: unknown): string => {
  if (error === null || error === undefined) return "Unknown error"
  if (typeof error === "string") return error
  if (error instanceof Error) {
    const causeMessage = "cause" in error && error.cause ? `: ${extractErrorMessage(error.cause)}` : ""
    return `${error.message}${causeMessage}`
  }
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    const causeMessage = "cause" in error && error.cause ? `: ${extractErrorMessage(error.cause)}` : ""
    return `${error.message}${causeMessage}`
  }
  return String(error)
}

const wrapPaletteError = (inputColor: string) => (error: unknown) =>
  new PaletteGenerationError({
    message: `Failed to generate palette for ${inputColor}: ${extractErrorMessage(error)}`,
    cause: error
  })

const resolvePatternSource = (
  input: PaletteRequest,
  configPatternSource: FilePathType
): Effect.Effect<FilePathType, PaletteGenerationError> =>
  input.patternSource
    ? FilePath(input.patternSource).pipe(
      Effect.mapError(
        (error) =>
          new PaletteGenerationError({
            message: `Invalid pattern source: ${input.patternSource}`,
            cause: error
          })
      )
    )
    : Effect.succeed(configPatternSource)

const getCurrentISOTimestamp = Effect.clockWith((clock) =>
  clock.currentTimeMillis.pipe(
    Effect.map((millis) => Schema.decodeSync(ISOTimestampSchema)(new Date(millis).toISOString()))
  )
)

// ============================================================================
// Service
// ============================================================================

/** Provides palette generation with dependency injection for PatternService and ConfigService. */
export class PaletteService extends Effect.Service<PaletteService>()(
  "@oklch-palette-generator/services/PaletteService",
  {
    effect: Effect.gen(function*() {
      const patternService = yield* PatternService
      const configService = yield* ConfigService

      const generate = (
        input: PaletteRequest
      ): Effect.Effect<PaletteResult, PaletteGenerationError> =>
        Effect.gen(function*() {
          const { anchorStop, inputColor, outputFormat, paletteName } = input
          const config = yield* configService.getConfig()
          const patternSource = yield* resolvePatternSource(input, config.patternSource)

          const oklchColor = yield* parseColorStringToOKLCH(inputColor)
          const pattern = yield* patternService.loadPattern(patternSource)
          const palette = yield* generatePaletteFromStop(
            oklchColor,
            anchorStop,
            pattern,
            paletteName
          )

          const formattedStops = yield* formatPaletteStops(palette.stops, outputFormat)

          return yield* PaletteResult({
            anchorStop,
            inputColor,
            name: palette.name,
            outputFormat,
            stops: formattedStops
          })
        }).pipe(Effect.mapError(wrapPaletteError(input.inputColor)))

      const generateBatch = (
        input: BatchRequest
      ): Effect.Effect<BatchResult, PaletteGenerationError> =>
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

          const successfulPalettes = Array.getSomes(Array.map(results, Either.getRight))

          // Extract failures with their original color/stop pairs
          const failures: ReadonlyArray<GenerationFailure> = Array.filterMap(
            Array.zip(input.pairs, results),
            ([pair, result]) =>
              Either.match(result, {
                onLeft: (error): O.Option<GenerationFailure> =>
                  O.some({
                    color: pair.color,
                    stop: pair.stop,
                    error: error.message
                  }),
                onRight: () => O.none()
              })
          )

          if (!Array.isNonEmptyReadonlyArray(successfulPalettes)) {
            return yield* Effect.fail(
              new PaletteGenerationError({
                message: `All palette generations failed: ${failures.map((f) => `${f.color} (${f.error})`).join(", ")}`
              })
            )
          }

          const generatedAt = yield* getCurrentISOTimestamp

          return {
            groupName: input.paletteGroupName,
            outputFormat: input.outputFormat,
            palettes: successfulPalettes,
            failures,
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
  /** Test layer using ConfigService.Test and PatternService.Test for predictable behavior. */
  static readonly Test = PaletteService.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.mergeAll(PatternService.Test, ConfigService.Test))
  )
}
