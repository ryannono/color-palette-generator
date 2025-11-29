/**
 * Transformation mode handler
 *
 * Applies optical appearance transformations and generates palettes.
 */

import { Array as Arr, Effect, Option as O, pipe } from "effect"
import { applyOpticalAppearance, oklchToHex, parseColorStringToOKLCH } from "../../../../../domain/color/color.js"
import {
  type ColorSpace as ColorSpaceType,
  ColorSpace as decodeColorSpace
} from "../../../../../domain/color/color.schema.js"
import { ConfigService } from "../../../../../services/ConfigService.js"
import { BatchResult, ISOTimestamp } from "../../../../../services/PaletteService/palette.schema.js"
import {
  buildExportConfig,
  displayPalette,
  executeBatchExport,
  executePaletteExport,
  generateAndDisplay
} from "../../output/formatter.js"
import type { TransformationBatch, TransformationRequest } from "./transformation.schema.js"

// ============================================================================
// Types
// ============================================================================

type GeneratedPalette = Effect.Effect.Success<ReturnType<typeof generateAndDisplay>>

type TransformationOptions = {
  readonly exportOpt: O.Option<string>
  readonly exportPath: O.Option<string>
  readonly formatOpt: O.Option<string>
  readonly nameOpt: O.Option<string>
  readonly pattern: string
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Handle single transformation: ref>target::stop
 *
 * Applies the reference color's optical appearance (lightness + chroma)
 * to the target color's hue, then generates a palette at the specified stop.
 */
export const handleSingleTransformation = ({
  exportOpt,
  exportPath,
  formatOpt,
  input,
  nameOpt,
  pattern
}: TransformationOptions & { readonly input: TransformationRequest }) =>
  Effect.gen(function*() {
    const format = yield* parseFormat(formatOpt)
    const result = yield* transformAndGenerate(
      input.reference,
      input.target,
      input.stop,
      O.getOrElse(nameOpt, () => "transformed"),
      format,
      pattern
    )

    yield* displayPalette(result)
    yield* handleSingleExport(result, exportOpt, exportPath)

    return result
  })

/**
 * Handle one-to-many transformation: ref>(t1,t2,t3)::stop
 *
 * Applies a single reference color's optical appearance to multiple target hues.
 * Each target receives the same lightness and chroma, varying only by hue.
 */
export const handleOneToManyTransformation = ({
  exportOpt,
  exportPath,
  formatOpt,
  input,
  nameOpt,
  pattern
}: TransformationOptions & { readonly input: TransformationBatch }) =>
  Effect.gen(function*() {
    const format = yield* parseFormat(formatOpt)
    const referenceColor = yield* parseColorStringToOKLCH(input.reference)

    const results = yield* Effect.forEach(
      input.targets,
      (target) =>
        Effect.gen(function*() {
          const targetColor = yield* parseColorStringToOKLCH(target)
          const transformedColor = yield* applyOpticalAppearance(referenceColor, targetColor)
          const transformedHex = yield* oklchToHex(transformedColor)

          const name = O.match(nameOpt, {
            onNone: () => `transformed-${target}`,
            onSome: (n) => `${n}-${target}`
          })

          return yield* generateAndDisplay({
            color: transformedHex,
            format,
            name,
            pattern,
            stop: input.stop
          })
        }),
      { concurrency: "unbounded" }
    )

    // Display all palettes after generation completes
    yield* Effect.forEach(results, displayPalette, { concurrency: 1 })

    yield* handleBatchExport(results, exportOpt, exportPath, "one-to-many-transformation")

    return results
  })

/**
 * Handle batch transformations (multiple lines)
 *
 * Processes multiple transformation inputs, each potentially being a single
 * or one-to-many transformation. Results are flattened into a single array.
 */
export const handleBatchTransformations = ({
  exportOpt,
  exportPath,
  formatOpt,
  inputs,
  nameOpt,
  pattern
}: TransformationOptions & {
  readonly inputs: ReadonlyArray<TransformationRequest | TransformationBatch>
}) =>
  Effect.gen(function*() {
    const format = yield* parseFormat(formatOpt)

    // Generate all palettes in parallel
    const nestedResults = yield* Effect.forEach(
      inputs,
      (input) =>
        "targets" in input
          ? generateOneToMany(input, format, nameOpt, pattern)
          : Effect.map(
            generateSingle(input, format, nameOpt, pattern),
            (result) => [result]
          ),
      { concurrency: "unbounded" }
    )

    const results = Arr.flatten(nestedResults)

    // Display all palettes sequentially (for clean output)
    yield* Effect.forEach(results, displayPalette, { concurrency: 1 })

    const config = yield* ConfigService
    const configData = yield* config.getConfig()
    yield* handleBatchExport(results, exportOpt, exportPath, configData.defaultBatchName)

    return results
  })

// ============================================================================
// Generation Helpers (no display/export)
// ============================================================================

/** Generate palette for a single transformation (no display) */
const generateSingle = (
  input: TransformationRequest,
  format: ColorSpaceType,
  nameOpt: O.Option<string>,
  pattern: string
) =>
  Effect.gen(function*() {
    const referenceColor = yield* parseColorStringToOKLCH(input.reference)
    const targetColor = yield* parseColorStringToOKLCH(input.target)
    const transformedColor = yield* applyOpticalAppearance(referenceColor, targetColor)
    const transformedHex = yield* oklchToHex(transformedColor)

    return yield* generateAndDisplay({
      color: transformedHex,
      format,
      name: O.getOrElse(nameOpt, () => "transformed"),
      pattern,
      stop: input.stop
    })
  })

/** Generate palettes for one-to-many transformation (no display) */
const generateOneToMany = (
  input: TransformationBatch,
  format: ColorSpaceType,
  nameOpt: O.Option<string>,
  pattern: string
) =>
  Effect.gen(function*() {
    const referenceColor = yield* parseColorStringToOKLCH(input.reference)

    return yield* Effect.forEach(
      input.targets,
      (target) =>
        Effect.gen(function*() {
          const targetColor = yield* parseColorStringToOKLCH(target)
          const transformedColor = yield* applyOpticalAppearance(referenceColor, targetColor)
          const transformedHex = yield* oklchToHex(transformedColor)

          const name = O.match(nameOpt, {
            onNone: () => `transformed-${target}`,
            onSome: (n) => `${n}-${target}`
          })

          return yield* generateAndDisplay({
            color: transformedHex,
            format,
            name,
            pattern,
            stop: input.stop
          })
        }),
      { concurrency: "unbounded" }
    )
  })

// ============================================================================
// Transformation
// ============================================================================

/** Parse format option with default */
const parseFormat = (formatOpt: O.Option<string>) => decodeColorSpace(O.getOrElse(formatOpt, () => "hex"))

/** Transform a single color and generate palette */
const transformAndGenerate = (
  reference: string,
  target: string,
  stop: TransformationRequest["stop"],
  name: string,
  format: ColorSpaceType,
  pattern: string
) =>
  Effect.gen(function*() {
    const referenceColor = yield* parseColorStringToOKLCH(reference)
    const targetColor = yield* parseColorStringToOKLCH(target)
    const transformedColor = yield* applyOpticalAppearance(referenceColor, targetColor)
    const transformedHex = yield* oklchToHex(transformedColor)

    return yield* generateAndDisplay({
      color: transformedHex,
      format,
      name,
      pattern,
      stop
    })
  })

// ============================================================================
// Export Handling
// ============================================================================

/** Handle export for a single palette */
const handleSingleExport = (
  result: GeneratedPalette,
  exportOpt: O.Option<string>,
  exportPath: O.Option<string>
) =>
  Effect.gen(function*() {
    const exportConfig = yield* buildExportConfig(exportOpt, exportPath)

    yield* O.match(exportConfig, {
      onNone: () => Effect.void,
      onSome: (config) => executePaletteExport(result, config)
    })
  })

/** Handle export for batch palettes */
const handleBatchExport = (
  results: ReadonlyArray<GeneratedPalette>,
  exportOpt: O.Option<string>,
  exportPath: O.Option<string>,
  groupName: string
) =>
  Effect.gen(function*() {
    const exportConfig = yield* buildExportConfig(exportOpt, exportPath)

    yield* O.match(exportConfig, {
      onNone: () => Effect.void,
      onSome: (config) =>
        Effect.gen(function*() {
          const generatedAt = yield* Effect.clockWith((clock) =>
            clock.currentTimeMillis.pipe(
              Effect.flatMap((millis) => ISOTimestamp(new Date(millis).toISOString()))
            )
          )

          const configService = yield* ConfigService
          const configData = yield* configService.getConfig()
          const outputFormat = pipe(
            Arr.head(results),
            O.map((r) => r.outputFormat),
            O.getOrElse(() => configData.defaultOutputFormat)
          )

          const batch = yield* BatchResult({
            generatedAt,
            groupName,
            outputFormat,
            palettes: [...results],
            partial: false
          })

          return yield* executeBatchExport(batch, config)
        })
    })
  })
