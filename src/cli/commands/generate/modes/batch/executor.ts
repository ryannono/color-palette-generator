/**
 * Batch mode palette generation handler
 *
 * Generates multiple palettes from a batch of color/stop pairs.
 */

import * as clack from "@clack/prompts"
import { Array as Arr, Data, Effect, Exit, HashMap, Option as O, pipe } from "effect"
import type { ColorSpace } from "../../../../../domain/color/color.schema.js"
import type { StopPosition } from "../../../../../domain/palette/palette.schema.js"
import { ConfigService } from "../../../../../services/ConfigService.js"
import { PaletteService } from "../../../../../services/PaletteService/index.js"
import type { BatchResult, ColorAnchor } from "../../../../../services/PaletteService/palette.schema.js"
import { promptForPaletteName, promptForStop } from "../../../../prompts.js"
import { buildExportConfig, displayBatch, executeBatchExport } from "../../output/formatter.js"
import { type ParsedPair, setPairStop } from "../../parsers/batch-parser.js"
import { validateFormat } from "../../validation.js"

// ============================================================================
// Constants
// ============================================================================

/** Log messages for batch mode operations */
const Messages = {
  foundColors: (count: number) => `Found ${count} color(s)`,
  generated: (count: number, partial: boolean) =>
    partial
      ? `Generated ${count} palette(s) with some failures`
      : `Generated ${count} palette(s)`,
  generating: (count: number) => `Generating ${count} palette(s)...`,
  missingStops: (count: number) => `${count} color(s) missing stop position`,
  operationFailed: "Operation failed"
}

// ============================================================================
// Types
// ============================================================================

/** Execution mode for CLI operations */
type ExecutionMode = Data.TaggedEnum<{
  Interactive: object
  Silent: object
}>

const ExecutionMode = Data.taggedEnum<ExecutionMode>()

/** Type guard for interactive mode */
const isInteractiveMode = ExecutionMode.$is("Interactive")

/** Convert boolean to ExecutionMode */
const toExecutionMode = (isInteractive: boolean): ExecutionMode =>
  isInteractive ? ExecutionMode.Interactive() : ExecutionMode.Silent()

type BatchModeOptions = {
  readonly exportOpt: O.Option<string>
  readonly exportPath: O.Option<string>
  readonly formatOpt: O.Option<string>
  readonly isInteractive: boolean
  readonly nameOpt: O.Option<string>
  readonly pairs: ReadonlyArray<ParsedPair>
  readonly pattern: string
}

/** Pair with its original index for tracking during completion */
type IndexedPair = {
  readonly originalIndex: number
  readonly pair: ParsedPair
}

/** A pair with a guaranteed stop position (after completion) */
type CompletePair = {
  readonly color: string
  readonly raw: string
  readonly stop: StopPosition
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Handle batch mode palette generation
 *
 * Prompts for missing stops, generates palettes, and handles export.
 */
export const handleBatchMode = ({
  exportOpt,
  exportPath,
  formatOpt,
  isInteractive,
  nameOpt,
  pairs,
  pattern
}: BatchModeOptions) =>
  Effect.gen(function*() {
    const mode = toExecutionMode(isInteractive)

    yield* logWhenInteractive(clack.log.success, Messages.foundColors(pairs.length), mode)

    // Complete pairs with missing stops
    const completedPairs = yield* completeMissingStops(pairs, mode)

    // Convert to ColorAnchor array
    const colorAnchors = toColorAnchors(completedPairs)

    // Get output format with validation
    const format = yield* validateFormat(formatOpt)

    // Get group name
    const config = yield* ConfigService
    const configData = yield* config.getConfig()
    const groupName = yield* O.match(nameOpt, {
      onNone: () => promptForPaletteName(configData.defaultBatchName),
      onSome: Effect.succeed
    })

    // Generate batch palettes
    const service = yield* PaletteService
    const batchResult = yield* withSpinner(
      generateBatch(service, colorAnchors, format, groupName, pattern),
      Messages.generating(colorAnchors.length),
      (result) => Messages.generated(result.palettes.length, result.partial),
      mode
    )

    // Display results
    yield* displayBatch(batchResult)

    // Handle export
    yield* handleExport(batchResult, exportOpt, exportPath)

    return batchResult
  })

// ============================================================================
// Logging
// ============================================================================

/** Log a message only when in interactive mode using Effect.when */
const logWhenInteractive = (
  logFn: (msg: string) => void,
  message: string,
  mode: ExecutionMode
): Effect.Effect<void> =>
  pipe(
    Effect.when(
      Effect.sync(() => logFn(message)),
      () => isInteractiveMode(mode)
    ),
    Effect.asVoid
  )

// ============================================================================
// Completion
// ============================================================================

/** Complete pairs that are missing stop positions by prompting user */
const completeMissingStops = (
  pairs: ReadonlyArray<ParsedPair>,
  mode: ExecutionMode
) =>
  Effect.gen(function*() {
    const incomplete = findIncompletePairs(pairs)

    if (incomplete.length === 0) {
      return toCompletePairs(pairs)
    }

    yield* logWhenInteractive(clack.log.warn, Messages.missingStops(incomplete.length), mode)

    // Prompt for each missing stop and collect completed pairs
    const nowComplete = yield* Effect.forEach(
      incomplete,
      ({ originalIndex, pair }) =>
        Effect.gen(function*() {
          const stop = yield* promptForStop(pair.color, originalIndex + 1)
          return yield* setPairStop(pair, stop)
        }),
      { concurrency: 1 }
    )

    // Merge complete pairs with newly completed ones, preserving original order
    return mergeCompletedPairs(pairs, nowComplete, incomplete)
  })

/** Find pairs that are missing stop positions with their original indices */
const findIncompletePairs = (pairs: ReadonlyArray<ParsedPair>): ReadonlyArray<IndexedPair> =>
  pipe(
    pairs,
    Arr.filterMap((pair, index) =>
      pair.stop === undefined
        ? O.some({ originalIndex: index, pair })
        : O.none()
    )
  )

/** Convert all pairs to CompletePairs (only valid when all have stops) */
const toCompletePairs = (pairs: ReadonlyArray<ParsedPair>): ReadonlyArray<CompletePair> =>
  pipe(
    pairs,
    Arr.filterMap((pair) =>
      pair.stop !== undefined
        ? O.some({ color: pair.color, raw: pair.raw, stop: pair.stop })
        : O.none()
    )
  )

/** Merge completed pairs back into original order using immutable HashMap */
const mergeCompletedPairs = (
  original: ReadonlyArray<ParsedPair>,
  nowComplete: ReadonlyArray<ParsedPair>,
  incomplete: ReadonlyArray<IndexedPair>
): ReadonlyArray<CompletePair> => {
  const completedByIndex = pipe(
    incomplete,
    Arr.zip(nowComplete),
    Arr.map(([{ originalIndex }, completed]) => [originalIndex, completed] as const),
    HashMap.fromIterable
  )

  return pipe(
    original,
    Arr.filterMap((pair, index) => {
      const merged = pipe(
        HashMap.get(completedByIndex, index),
        O.getOrElse(() => pair)
      )
      return merged.stop !== undefined
        ? O.some({ color: merged.color, raw: merged.raw, stop: merged.stop })
        : O.none()
    })
  )
}

// ============================================================================
// Conversion
// ============================================================================

/** Convert complete pairs to ColorAnchor array (no filtering needed) */
const toColorAnchors = (pairs: ReadonlyArray<CompletePair>): ReadonlyArray<ColorAnchor> =>
  pipe(
    pairs,
    Arr.map(({ color, stop }) => ({ color, stop }))
  )

// ============================================================================
// Generation
// ============================================================================

/** Wrap an effect with spinner feedback when in interactive mode */
const withSpinner = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  startMessage: string,
  completeMessage: (result: A) => string,
  mode: ExecutionMode
): Effect.Effect<A, E, R> =>
  isInteractiveMode(mode)
    ? Effect.acquireUseRelease(
      Effect.sync(() => {
        const spinner = clack.spinner()
        spinner.start(startMessage)
        return spinner
      }),
      () => effect,
      (spinner, exit) =>
        Effect.sync(() => {
          const message = Exit.isSuccess(exit)
            ? completeMessage(exit.value)
            : Messages.operationFailed
          spinner.stop(message)
        })
    )
    : effect

/** Generate batch palettes */
const generateBatch = (
  service: PaletteService,
  colorAnchors: ReadonlyArray<ColorAnchor>,
  format: ColorSpace,
  groupName: string,
  pattern: string
) =>
  service.generateBatch({
    outputFormat: format,
    pairs: colorAnchors,
    paletteGroupName: groupName,
    patternSource: pattern
  })

// ============================================================================
// Export
// ============================================================================

/** Handle export if configured */
const handleExport = (
  batchResult: BatchResult,
  exportOpt: O.Option<string>,
  exportPath: O.Option<string>
) =>
  pipe(
    buildExportConfig(exportOpt, exportPath),
    Effect.flatMap(
      O.match({
        onNone: () => Effect.void,
        onSome: (config) => executeBatchExport(batchResult, config)
      })
    )
  )
