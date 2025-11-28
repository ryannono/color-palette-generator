/**
 * Transformation completion utilities
 *
 * Completes partial batch transformations by prompting for missing stops.
 */

import { Array as Arr, Data, Effect, Option } from "effect"
import type { ParseError } from "effect/ParseResult"
import type { StopPosition } from "../../../../../domain/palette/palette.schema.js"
import { promptForStop } from "../../../../prompts.js"
import type {
  PartialTransformationBatch,
  PartialTransformationInput,
  TransformationBatch,
  TransformationInput
} from "../../../../schemas/transformation.schema.js"

// ============================================================================
// Types
// ============================================================================

/** All possible transformation input types (complete or partial) */
type InputType =
  | TransformationInput
  | TransformationBatch
  | PartialTransformationInput
  | PartialTransformationBatch

/** Fully validated transformation output types */
type OutputType = TransformationInput | TransformationBatch

/** Result of processing a single transformation */
type ProcessResult = {
  readonly completed: Option.Option<OutputType>
  readonly wasPartial: boolean
}

/** Discriminated union for transformation states */
type ClassifiedTransformation = Data.TaggedEnum<{
  CompleteBatch: { readonly data: TransformationBatch }
  CompleteSingle: { readonly data: TransformationInput }
  PartialBatch: { readonly reference: string; readonly targets: ReadonlyArray<string> }
  PartialSingle: { readonly reference: string; readonly target: string }
  Invalid: object
}>

const ClassifiedTransformation = Data.taggedEnum<ClassifiedTransformation>()

// ============================================================================
// Public API
// ============================================================================

/**
 * Complete partial batch transformations by prompting for missing stops
 *
 * Takes an array of potentially partial transformations and returns
 * completed transformations with all required fields filled.
 */
export const completePartialTransformations = (
  transformations: ReadonlyArray<InputType>
): Effect.Effect<
  {
    readonly inputs: ReadonlyArray<OutputType>
    readonly hadPartial: boolean
  },
  ParseError
> =>
  Effect.forEach(
    transformations,
    (t, idx) => processTransformation(t, idx + 1),
    { concurrency: 1 }
  ).pipe(Effect.map(aggregateResults))

// ============================================================================
// Processing
// ============================================================================

/** Classify and process a single transformation, prompting for stop if needed */
const processTransformation = (
  transformation: InputType,
  index: number
): Effect.Effect<ProcessResult, ParseError> => {
  const classified = classifyTransformation(transformation)
  const description = buildPromptDescription(classified)

  return ClassifiedTransformation.$match(classified, {
    CompleteBatch: ({ data }) => completeResult(data),
    CompleteSingle: ({ data }) => completeResult(data),
    PartialBatch: ({ reference, targets }) =>
      partialResult(description, index, (stop) => ({ reference, targets, stop })),
    PartialSingle: ({ reference, target }) =>
      partialResult(description, index, (stop) => ({ reference, target, stop })),
    Invalid: () => invalidResult
  })
}

// ============================================================================
// Classification
// ============================================================================

/** Classify transformation into explicit state based on available fields */
const classifyTransformation = (t: InputType): ClassifiedTransformation => {
  const hasReference = typeof t.reference === "string" && t.reference.length > 0
  const hasStop = "stop" in t && typeof t.stop === "number"

  if ("targets" in t && Array.isArray(t.targets) && t.targets.length > 0 && hasReference) {
    return hasStop
      ? ClassifiedTransformation.CompleteBatch({ data: { reference: t.reference, targets: t.targets, stop: t.stop } })
      : ClassifiedTransformation.PartialBatch({ reference: t.reference, targets: t.targets })
  }

  if ("target" in t && typeof t.target === "string" && t.target.length > 0 && hasReference) {
    return hasStop
      ? ClassifiedTransformation.CompleteSingle({ data: { reference: t.reference, target: t.target, stop: t.stop } })
      : ClassifiedTransformation.PartialSingle({ reference: t.reference, target: t.target })
  }

  return ClassifiedTransformation.Invalid()
}

/** Build prompt description for partial transformations (None for complete/invalid) */
const buildPromptDescription = (classified: ClassifiedTransformation): Option.Option<string> =>
  ClassifiedTransformation.$match(classified, {
    CompleteBatch: () => Option.none(),
    CompleteSingle: () => Option.none(),
    PartialBatch: ({ reference, targets }) => Option.some(`${reference}>(${targets.join(", ")})`),
    PartialSingle: ({ reference, target }) => Option.some(`${reference}>${target}`),
    Invalid: () => Option.none()
  })

// ============================================================================
// Result Builders
// ============================================================================

/** Create result for a fully specified transformation */
const completeResult = (data: OutputType): Effect.Effect<ProcessResult, never> =>
  Effect.succeed({ completed: Option.some(data), wasPartial: false })

/** Result for malformed transformations */
const invalidResult: Effect.Effect<ProcessResult, never> = Effect.succeed({
  completed: Option.none(),
  wasPartial: false
})

/** Prompt for stop and create result with builder */
const partialResult = (
  description: Option.Option<string>,
  index: number,
  builder: (stop: StopPosition) => OutputType
): Effect.Effect<ProcessResult, ParseError> =>
  promptForStop(Option.getOrUndefined(description), index).pipe(
    Effect.map((stop) => ({ completed: Option.some(builder(stop)), wasPartial: true }))
  )

// ============================================================================
// Aggregation
// ============================================================================

/** Collect completed transformations and track if any were partial */
const aggregateResults = (results: ReadonlyArray<ProcessResult>) => ({
  inputs: Arr.getSomes(Arr.map(results, (r) => r.completed)),
  hadPartial: Arr.some(results, (r) => r.wasPartial)
})
