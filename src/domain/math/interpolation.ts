/**
 * Interpolation and smoothing utilities for color palette generation
 */

import { Array as Arr, Data, Effect } from "effect"
import type { StopPosition } from "../palette/palette.schema.js"
import { STOP_POSITIONS } from "../palette/palette.schema.js"
import type { StopTransform, TransformationPattern } from "../pattern/pattern.js"
import {
  buildStopNumberMap,
  CollectionError,
  getStopNumber,
  getStopTransform,
  type StopTransformMap
} from "../types/collections.js"

// ============================================================================
// Errors
// ============================================================================

/** Error when interpolation or smoothing operations fail */
export class InterpolationError extends Data.TaggedError("InterpolationError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ============================================================================
// Constants
// ============================================================================

/** Stop position constants */
const LIGHTEST_STOP = 100 satisfies StopPosition
const REFERENCE_STOP = 500 satisfies StopPosition
const DARKEST_STOP = 1000 satisfies StopPosition

/** Reference multiplier is always 1.0 (no change from reference) */
const REFERENCE_MULTIPLIER = 1.0

/** Range of stop positions for normalization */
const STOP_RANGE = DARKEST_STOP - LIGHTEST_STOP // 900

/** Degrees to radians conversion factor */
export const DEG_TO_RAD = Math.PI / 180

/** Radians to degrees conversion factor */
export const RAD_TO_DEG = 180 / Math.PI

// ============================================================================
// Public API
// ============================================================================

/**
 * Smooth the transformation pattern to ensure:
 * - Lightness is perfectly linear
 * - Chroma follows a smooth curve
 * - Hue is consistent (circular mean value)
 */
export const smoothPattern = (
  pattern: TransformationPattern
): Effect.Effect<TransformationPattern, InterpolationError> =>
  Effect.gen(function*() {
    const [lightnessMultipliers, chromaMultipliers, consistentHue] = yield* Effect.all([
      calculateLinearLightness(pattern),
      smoothChromaCurve(pattern),
      calculateConsistentHue(pattern)
    ]).pipe(
      Effect.mapError((cause) => new InterpolationError({ message: "Failed to smooth pattern", cause }))
    )

    const transforms = yield* buildTransformMap(
      lightnessMultipliers,
      chromaMultipliers,
      consistentHue
    ).pipe(
      Effect.mapError((cause) => new InterpolationError({ message: "Failed to build transform map", cause }))
    )

    return {
      ...pattern,
      name: `${pattern.name}-smoothed`,
      transforms
    }
  })

/** Linear interpolation between two values */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Clamp a value between min and max */
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

/**
 * Calculate circular mean of angular values (handles wraparound at ±180°)
 *
 * Standard circular mean: convert angles to unit vectors, average, convert back.
 * This correctly handles values clustered around the ±180° boundary.
 *
 * For example:
 * - circularMean([-175, 175]) ≈ 180 (not 0)
 * - circularMean([10, 20, 30]) = 20 (same as linear mean)
 *
 * @param angles - Array of angles in degrees
 * @param onEmpty - Function to create error when array is empty
 */
export const circularMeanWith = <E>(
  angles: ReadonlyArray<number>,
  onEmpty: () => E
): Effect.Effect<number, E> =>
  Arr.match(angles, {
    onEmpty: () => Effect.fail(onEmpty()),
    onNonEmpty: (nonEmpty) => {
      // Convert to unit vectors and sum
      const sumSin = Arr.reduce(nonEmpty, 0, (sum, angle) => sum + Math.sin(angle * DEG_TO_RAD))
      const sumCos = Arr.reduce(nonEmpty, 0, (sum, angle) => sum + Math.cos(angle * DEG_TO_RAD))

      // Average the vectors
      const avgSin = sumSin / nonEmpty.length
      const avgCos = sumCos / nonEmpty.length

      // Convert back to angle
      const resultRad = Math.atan2(avgSin, avgCos)
      return Effect.succeed(resultRad * RAD_TO_DEG)
    }
  })

// ============================================================================
// Pattern Smoothing Helpers
// ============================================================================

/** Build a StopTransformMap by combining lightness, chroma, and hue values */
const buildTransformMap = (
  lightnessMultipliers: ReadonlyMap<StopPosition, number>,
  chromaMultipliers: ReadonlyMap<StopPosition, number>,
  hueShiftDegrees: number
): Effect.Effect<StopTransformMap, InterpolationError | CollectionError> =>
  Effect.all(
    STOP_POSITIONS.map((position) =>
      Effect.all([
        getStopNumber(lightnessMultipliers, position),
        getStopNumber(chromaMultipliers, position)
      ]).pipe(
        Effect.map(([lightness, chroma]) => ({
          position,
          transform: {
            lightnessMultiplier: lightness,
            chromaMultiplier: chroma,
            hueShiftDegrees
          }
        }))
      )
    )
  ).pipe(
    Effect.map((entries) => new Map(entries.map(({ position, transform }) => [position, transform])))
  )

/** Calculate lightness multipliers using quadratic interpolation */
const calculateLinearLightness = (
  pattern: TransformationPattern
): Effect.Effect<ReadonlyMap<StopPosition, number>, InterpolationError | CollectionError> =>
  createQuadraticInterpolation(pattern, (t) => t.lightnessMultiplier)

/** Smooth chroma curve using quadratic interpolation */
const smoothChromaCurve = (
  pattern: TransformationPattern
): Effect.Effect<ReadonlyMap<StopPosition, number>, InterpolationError | CollectionError> =>
  createQuadraticInterpolation(pattern, (t) => t.chromaMultiplier)

/** Calculate consistent hue shift using circular mean of all values */
const calculateConsistentHue = (
  pattern: TransformationPattern
): Effect.Effect<number, InterpolationError | CollectionError> =>
  Effect.all(
    STOP_POSITIONS.map((pos) =>
      getStopTransform(pattern.transforms, pos).pipe(
        Effect.map((t) => t.hueShiftDegrees)
      )
    )
  ).pipe(
    Effect.flatMap(circularMean)
  )

// ============================================================================
// Interpolation Utilities
// ============================================================================

/** Property extractor type for StopTransform */
type TransformPropertyExtractor = (transform: StopTransform) => number

/** Create a quadratic interpolation curve through three key points (100, 500, 1000) */
const createQuadraticInterpolation = (
  pattern: TransformationPattern,
  extractProperty: TransformPropertyExtractor
): Effect.Effect<ReadonlyMap<StopPosition, number>, CollectionError> =>
  Effect.all([
    getStopTransform(pattern.transforms, LIGHTEST_STOP),
    getStopTransform(pattern.transforms, DARKEST_STOP)
  ]).pipe(
    Effect.map(([transform100, transform1000]) => {
      const value100 = extractProperty(transform100)
      const value500 = REFERENCE_MULTIPLIER
      const value1000 = extractProperty(transform1000)

      // Fit quadratic curve y = ax^2 + bx + c through three points
      const c = value100
      const x_mid = normalizePosition(REFERENCE_STOP)

      const a = (value500 - c - value1000 * x_mid + c * x_mid) / (x_mid * x_mid - x_mid)
      const b = value1000 - c - a

      return buildStopNumberMap((position) => {
        const x = normalizePosition(position)
        return Math.max(0, a * x * x + b * x + c)
      })
    })
  )

/** Normalize a stop position to [0, 1] range */
const normalizePosition = (position: StopPosition): number => (position - LIGHTEST_STOP) / STOP_RANGE

// ============================================================================
// Circular Statistics Helpers
// ============================================================================

/** Circular mean with InterpolationError */
const circularMean = (angles: ReadonlyArray<number>): Effect.Effect<number, InterpolationError> =>
  circularMeanWith(
    angles,
    () => new InterpolationError({ message: "Failed to calculate circular mean: array is empty" })
  )
