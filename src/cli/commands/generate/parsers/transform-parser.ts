/**
 * Transformation input parsing utilities
 *
 * Parses transformation syntax like:
 * - Single: "2D72D2>238551::500"
 * - One-to-many: "2D72D2>(238551,DC143C)::500"
 * - Batch: Multiple lines or comma-separated transformations
 */

import { Data, Effect, Option as O, pipe } from "effect"
import type { ParseError } from "effect/ParseResult"
import type {
  PartialTransformationBatch,
  PartialTransformationRequest,
  TransformationBatch,
  TransformationRequest
} from "../modes/transform/transformation.schema.js"
import {
  PartialTransformationBatch as PartialTransformationBatchDecoder,
  PartialTransformationRequest as PartialTransformationRequestDecoder,
  TransformationBatch as TransformationBatchDecoder,
  TransformationRequest as TransformationRequestDecoder
} from "../modes/transform/transformation.schema.js"

// ============================================================================
// Errors
// ============================================================================

export class TransformParseError extends Data.TaggedError("TransformParseError")<{
  readonly message: string
}> {}

// ============================================================================
// Types
// ============================================================================

type ParsedTargetAndStop = {
  readonly target: string
  readonly stopStr: O.Option<string>
}

type ParsedTargetsAndStop = {
  readonly targets: ReadonlyArray<string>
  readonly stopStr: O.Option<string>
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse a single transformation string: ref>target::stop
 *
 * Supports formats:
 * - ref>target::stop → "2D72D2>238551::500"
 * - ref>target:stop  → "2D72D2>238551:500"
 * - ref>target stop  → "2D72D2>238551 500"
 * - ref>target       → "2D72D2>238551" (partial, stop will be prompted for)
 */
export const parseTransformationString = (
  input: string
): Effect.Effect<
  TransformationRequest | PartialTransformationRequest,
  TransformParseError | ParseError
> =>
  Effect.gen(function*() {
    const trimmed = yield* requireOperator(input.trim(), ">")
    const [refPart, targetPart] = yield* splitFirst(trimmed, ">")
    const reference = yield* extractNonEmpty(refPart, "reference", trimmed)
    const validTargetPart = yield* requireNonEmpty(targetPart, "target part", trimmed)
    return yield* buildSingleTransformation(reference, validTargetPart)
  })

/**
 * Parse a one-to-many transformation string: ref>(t1,t2,t3)::stop
 *
 * Supports formats:
 * - ref>(t1,t2)::stop → "2D72D2>(238551,DC143C)::500"
 * - ref>(t1,t2):stop  → "2D72D2>(238551,DC143C):500"
 */
export const parseOneToManyTransformation = (
  input: string
): Effect.Effect<
  TransformationBatch | PartialTransformationBatch,
  TransformParseError | ParseError
> =>
  Effect.gen(function*() {
    const trimmed = yield* requireOneToManySyntax(input.trim())
    const [refPart, rest] = yield* splitFirst(trimmed, ">")
    const reference = yield* extractNonEmpty(refPart, "reference", trimmed)
    const validRest = yield* requireNonEmpty(rest, "targets", trimmed)
    const { stopStr, targets } = yield* extractParenthesizedTargets(validRest, trimmed)
    return yield* buildBatchTransformation(reference, targets, stopStr)
  })

/** Detect if input string is a transformation (contains >) */
export const isTransformationSyntax = (input: string): boolean => input.trim().includes(">")

/** Detect if input is one-to-many transformation (has parentheses) */
export const isOneToManyTransformation = (input: string): boolean => {
  const trimmed = input.trim()
  return trimmed.includes(">") && trimmed.includes("(") && trimmed.includes(")")
}

/**
 * Parse any transformation input (auto-detects format)
 */
export const parseAnyTransformation = (
  input: string
): Effect.Effect<
  | TransformationRequest
  | TransformationBatch
  | PartialTransformationRequest
  | PartialTransformationBatch,
  TransformParseError | ParseError
> =>
  isOneToManyTransformation(input)
    ? parseOneToManyTransformation(input)
    : parseTransformationString(input)

/**
 * Parse multiple transformation inputs (batch mode)
 *
 * Supports:
 * - Newline-separated transformations
 * - Comma-separated transformations (respecting parentheses)
 * - Mixed single and one-to-many transformations
 */
export const parseBatchTransformations = (
  input: string
): Effect.Effect<
  Array<TransformationRequest | TransformationBatch | PartialTransformationRequest | PartialTransformationBatch>,
  TransformParseError | ParseError
> =>
  pipe(
    input.split(/\n/).map((s) => s.trim()).filter((s) => s.length > 0),
    (lines) => lines.flatMap(splitByCommaOutsideParens),
    (allInputs) => Effect.all(allInputs.map(parseAnyTransformation), { concurrency: "unbounded" })
  )

// ============================================================================
// Helpers - Validation
// ============================================================================

/** Require input contains the specified operator */
const requireOperator = (
  input: string,
  operator: string
): Effect.Effect<string, TransformParseError> =>
  input.includes(operator)
    ? Effect.succeed(input)
    : Effect.fail(
      new TransformParseError({
        message: `Transformation syntax requires '${operator}' operator (e.g., 'ref>target::stop'): ${input}`
      })
    )

/** Require one-to-many syntax with parentheses */
const requireOneToManySyntax = (input: string): Effect.Effect<string, TransformParseError> =>
  input.includes(">") && input.includes("(") && input.includes(")")
    ? Effect.succeed(input)
    : Effect.fail(
      new TransformParseError({
        message: `One-to-many syntax requires '>(...)'  (e.g., 'ref>(t1,t2)::stop'): ${input}`
      })
    )

/** Extract non-empty trimmed value or fail */
const extractNonEmpty = (
  value: string | undefined,
  name: string,
  context: string
): Effect.Effect<string, TransformParseError> =>
  pipe(
    O.fromNullable(value),
    O.map((v) => v.trim()),
    O.filter((v) => v.length > 0),
    O.match({
      onNone: () =>
        Effect.fail(
          new TransformParseError({
            message: `Invalid transformation syntax: ${name} is required: ${context}`
          })
        ),
      onSome: Effect.succeed
    })
  )

/** Require value is non-empty */
const requireNonEmpty = (
  value: string | undefined,
  name: string,
  context: string
): Effect.Effect<string, TransformParseError> => extractNonEmpty(value, name, context)

// ============================================================================
// Helpers - Parsing
// ============================================================================

/** Split string by first occurrence of delimiter */
const splitFirst = (
  input: string,
  delimiter: string
): Effect.Effect<readonly [string, string], TransformParseError> => {
  const idx = input.indexOf(delimiter)
  return idx === -1
    ? Effect.fail(new TransformParseError({ message: `Missing '${delimiter}' in: ${input}` }))
    : Effect.succeed([input.substring(0, idx), input.substring(idx + 1)] as const)
}

/** Try parsing stop from string using specified separator */
const tryParseSeparator = (
  input: string,
  separator: string
): O.Option<string> =>
  pipe(
    O.some(input),
    O.filter((s) => s.includes(separator)),
    O.flatMap((s) => O.fromNullable(s.split(separator)[1])),
    O.map((s) => s.trim()),
    O.filter((s) => s.length > 0)
  )

/** Extract and trim the first part before a separator, returns Option */
const extractFirstPart = (input: string, separator: string): O.Option<string> =>
  pipe(
    O.fromNullable(input.split(separator)[0]),
    O.map((s) => s.trim()),
    O.filter((s) => s.length > 0)
  )

/** Parse target and stop from target part string */
const parseTargetAndStop = (targetPart: string): ParsedTargetAndStop => {
  const doubleColon = tryParseSeparator(targetPart, "::")
  if (O.isSome(doubleColon)) {
    return {
      stopStr: doubleColon,
      target: O.getOrElse(extractFirstPart(targetPart, "::"), () => targetPart.trim())
    }
  }

  const singleColon = tryParseSeparator(targetPart, ":")
  if (O.isSome(singleColon)) {
    return {
      stopStr: singleColon,
      target: O.getOrElse(extractFirstPart(targetPart, ":"), () => targetPart.trim())
    }
  }

  const parts = targetPart.trim().split(/\s+/)
  if (parts.length >= 2) {
    const target = pipe(
      O.fromNullable(parts[0]),
      O.map((s) => s.trim()),
      O.filter((s) => s.length > 0),
      O.getOrElse(() => targetPart.trim())
    )
    const stopStr = O.fromNullable(parts[1]?.trim()).pipe(O.filter((s) => s.length > 0))
    return { stopStr, target }
  }

  return { stopStr: O.none(), target: targetPart.trim() }
}

/** Extract targets from parentheses and parse stop */
const extractParenthesizedTargets = (
  rest: string,
  context: string
): Effect.Effect<ParsedTargetsAndStop, TransformParseError> => {
  const parenStart = rest.indexOf("(")
  const parenEnd = rest.indexOf(")")

  if (parenStart === -1 || parenEnd === -1 || parenEnd <= parenStart) {
    return Effect.fail(
      new TransformParseError({ message: `Invalid parentheses in one-to-many syntax: ${context}` })
    )
  }

  const targetsStr = rest.substring(parenStart + 1, parenEnd)
  const afterParen = rest.substring(parenEnd + 1)

  const targets = targetsStr
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  if (targets.length === 0) {
    return Effect.fail(
      new TransformParseError({
        message: `At least one target color is required in parentheses: ${context}`
      })
    )
  }

  const stopStr = pipe(
    tryParseSeparator(afterParen, "::"),
    O.orElse(() => tryParseSeparator(afterParen, ":")),
    O.orElse(() =>
      pipe(
        O.fromNullable(afterParen.trim().split(/\s+/).find((p) => /^\d+$/.test(p))),
        O.filter((s) => s.length > 0)
      )
    )
  )

  return Effect.succeed({ targets, stopStr })
}

/** Split by commas that are outside of parentheses using immutable reduce */
const splitByCommaOutsideParens = (input: string): Array<string> => {
  type State = { readonly results: Array<string>; readonly current: string; readonly depth: number }

  const initial: State = { results: [], current: "", depth: 0 }

  const processChar = (state: State, char: string): State => {
    if (char === "(") {
      return { ...state, current: state.current + char, depth: state.depth + 1 }
    }
    if (char === ")") {
      return { ...state, current: state.current + char, depth: state.depth - 1 }
    }
    if (char === "," && state.depth === 0) {
      const trimmed = state.current.trim()
      return {
        results: trimmed.length > 0 ? [...state.results, trimmed] : state.results,
        current: "",
        depth: 0
      }
    }
    return { ...state, current: state.current + char }
  }

  const finalState = [...input].reduce(processChar, initial)
  const lastTrimmed = finalState.current.trim()

  return lastTrimmed.length > 0 ? [...finalState.results, lastTrimmed] : finalState.results
}

// ============================================================================
// Helpers - Building Results
// ============================================================================

/** Build single transformation result from parsed parts */
const buildSingleTransformation = (
  reference: string,
  targetPart: string
): Effect.Effect<TransformationRequest | PartialTransformationRequest, TransformParseError | ParseError> => {
  const { stopStr, target } = parseTargetAndStop(targetPart)

  if (target.length === 0) {
    return Effect.fail(
      new TransformParseError({
        message: `Invalid transformation syntax: target color is required: ${targetPart}`
      })
    )
  }

  return O.match(stopStr, {
    onNone: () => PartialTransformationRequestDecoder({ reference, target }),
    onSome: (s) => TransformationRequestDecoder({ reference, target, stop: parseInt(s, 10) })
  })
}

/** Build batch transformation result from parsed parts */
const buildBatchTransformation = (
  reference: string,
  targets: ReadonlyArray<string>,
  stopStr: O.Option<string>
): Effect.Effect<TransformationBatch | PartialTransformationBatch, ParseError> =>
  O.match(stopStr, {
    onNone: () => PartialTransformationBatchDecoder({ reference, targets: [...targets] }),
    onSome: (s) => TransformationBatchDecoder({ reference, targets: [...targets], stop: parseInt(s, 10) })
  })
