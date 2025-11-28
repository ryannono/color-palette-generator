/**
 * Type-safe collection utilities for stop-position-based data
 *
 * Provides utilities for building and converting ReadonlyMap instances
 * without unsafe type casting.
 */

import { Data, Either } from "effect"
import type { StopPosition } from "../../schemas/palette.js"
import { STOP_POSITIONS } from "../../schemas/palette.js"
import type { StopTransform } from "../learning/pattern.js"

/**
 * Type alias for Map of stop positions to transforms
 */
export type StopTransformMap = ReadonlyMap<StopPosition, StopTransform>

/**
 * Type alias for Map of stop positions to numbers
 */
export type StopNumberMap = ReadonlyMap<StopPosition, number>

/**
 * Build a ReadonlyMap of stop positions to numbers
 *
 * Specialized version of buildStopMap for number values.
 *
 * @example
 * ```typescript
 * const weights = buildStopNumberMap((position) => calculateWeight(position))
 * ```
 */
export const buildStopNumberMap = (
  fn: (position: StopPosition) => number
): StopNumberMap => buildStopMap(fn)

/**
 * Build a ReadonlyMap of stop positions to transforms
 *
 * Specialized version of buildStopMap for StopTransform values.
 *
 * @example
 * ```typescript
 * const transforms = buildStopTransformMap((position) => ({
 *   lightnessMultiplier: 1.0,
 *   chromaMultiplier: 1.0,
 *   hueShiftDegrees: 0
 * }))
 * ```
 */
export const buildStopTransformMap = (
  fn: (position: StopPosition) => StopTransform
): StopTransformMap => buildStopMap(fn)

/**
 * Build a ReadonlyMap from all stop positions using a builder function
 *
 * Uses a functional approach: map positions to entries, then construct the Map.
 * This is a type-safe alternative to casting empty objects to Record types.
 *
 * @example
 * ```typescript
 * const lightnessMultipliers = buildStopMap((position) => ({
 *   lightnessMultiplier: calculateLightness(position),
 *   chromaMultiplier: calculateChroma(position),
 *   hueShiftDegrees: calculateHue(position)
 * }))
 * ```
 */
export const buildStopMap = <V>(
  fn: (position: StopPosition) => V
): ReadonlyMap<StopPosition, V> => new Map(STOP_POSITIONS.map((position) => [position, fn(position)]))

/**
 * Convert a ReadonlyMap to a plain object for JSON serialization
 *
 * Uses reduce to build the record in a type-safe manner.
 * The return type explicitly preserves key type information.
 *
 * @example
 * ```typescript
 * const record = mapToRecord(pattern.transforms)
 * const json = JSON.stringify(record)
 * ```
 */
export const mapToRecord = <K extends PropertyKey, V>(
  map: ReadonlyMap<K, V>
): Record<K, V> => {
  const entries = Array.from(map.entries())
  return entries.reduce<Record<K, V>>(
    (acc, [key, value]) => ({ ...acc, [key]: value }),
    {} as Record<K, V>
  )
}

/**
 * Convert a plain object to a ReadonlyMap
 *
 * Requires the list of keys to ensure all expected entries are present.
 * IMPORTANT: Caller must ensure all keys exist in the record with non-undefined values.
 * Missing keys will result in map entries with undefined values, violating the type contract.
 *
 * @example
 * ```typescript
 * const record = JSON.parse(json) as Record<StopPosition, StopTransform>
 * const map = recordToMap(record, STOP_POSITIONS)
 * ```
 */
export const recordToMap = <K extends PropertyKey, V>(
  record: Record<K, V>,
  keys: ReadonlyArray<K>
): ReadonlyMap<K, V> => new Map(keys.map((key) => [key, record[key]]))

/**
 * Transform values in a ReadonlyMap while preserving structure
 *
 * Standard functor map operation for Maps. Applies a function to each value
 * while keeping the same keys.
 *
 * @example
 * ```typescript
 * const doubled = mapStopMap(weights, (weight) => weight * 2)
 * const withPosition = mapStopMap(
 *   transforms,
 *   (transform, position) => ({ ...transform, position })
 * )
 * ```
 */
export const mapStopMap = <A, B>(
  stopMap: ReadonlyMap<StopPosition, A>,
  fn: (value: A, position: StopPosition) => B
): ReadonlyMap<StopPosition, B> =>
  new Map(
    Array.from(stopMap.entries()).map(([position, value]) => [
      position,
      fn(value, position)
    ])
  )

/**
 * Error when a stop position is missing from a map
 */
export class MissingStopPositionError extends Data.TaggedError("MissingStopPositionError")<{
  readonly position: StopPosition
  readonly mapType: "transform" | "number"
}> {}

/**
 * Safely get a value from a StopTransformMap using functional composition
 *
 * @example
 * ```typescript
 * const result = getStopTransform(pattern.transforms, 500)
 * if (Either.isLeft(result)) {
 *   console.error(`Missing position ${result.left.position}`)
 * } else {
 *   const lightness = result.right.lightnessMultiplier
 * }
 * ```
 */
export const getStopTransform = (
  map: StopTransformMap,
  position: StopPosition
): Either.Either<StopTransform, MissingStopPositionError> =>
  Either.fromNullable(
    map.get(position),
    () => new MissingStopPositionError({ position, mapType: "transform" })
  )

/**
 * Safely get a value from a StopNumberMap using functional composition
 *
 * @example
 * ```typescript
 * const result = getStopNumber(lightnessMultipliers, 500)
 * if (Either.isRight(result)) {
 *   const multiplier = result.right
 * }
 * ```
 */
export const getStopNumber = (
  map: StopNumberMap,
  position: StopPosition
): Either.Either<number, MissingStopPositionError> =>
  Either.fromNullable(
    map.get(position),
    () => new MissingStopPositionError({ position, mapType: "number" })
  )
