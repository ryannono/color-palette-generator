/**
 * Palette service request schemas
 *
 * Request schemas with service-specific defaults.
 * Result schemas are in domain/palette/palette.schema.ts
 */

import { Schema } from "effect"
import { DEFAULT_BATCH_NAME, DEFAULT_PALETTE_NAME } from "../../config/constants.js"
import { ColorSpaceSchema, ColorStringSchema } from "../../domain/color/color.schema.js"
import { ColorStopPairSchema, StopPositionSchema } from "../../domain/palette/palette.schema.js"

// ============================================================================
// Schema Combinators
// ============================================================================

/** Schema for pattern source string */
const PatternSourceSchema = Schema.String.pipe(
  Schema.annotations({
    identifier: "PatternSource",
    description: "File path or identifier for the pattern source"
  })
)

/** Optional pattern source for palette generation */
const OptionalPatternSource = Schema.optional(PatternSourceSchema)

// ============================================================================
// Single Palette Request
// ============================================================================

/** Request to generate a palette from a color and anchor stop */
export const PaletteRequestSchema = Schema.Struct({
  inputColor: ColorStringSchema,
  anchorStop: StopPositionSchema,
  outputFormat: ColorSpaceSchema,
  paletteName: Schema.optionalWith(Schema.String, {
    default: () => DEFAULT_PALETTE_NAME
  }),
  patternSource: OptionalPatternSource
}).pipe(
  Schema.annotations({
    identifier: "PaletteRequest",
    description: "Request parameters for generating a single color palette"
  })
)

export const PaletteRequest = Schema.decodeUnknown(PaletteRequestSchema)
export type PaletteRequest = typeof PaletteRequestSchema.Type

// ============================================================================
// Batch Palette Request
// ============================================================================

/** Request to generate multiple palettes in a single operation */
export const BatchRequestSchema = Schema.Struct({
  pairs: Schema.NonEmptyArray(ColorStopPairSchema),
  outputFormat: ColorSpaceSchema,
  paletteGroupName: Schema.optionalWith(Schema.String, {
    default: () => DEFAULT_BATCH_NAME
  }),
  patternSource: OptionalPatternSource
}).pipe(
  Schema.annotations({
    identifier: "BatchRequest",
    description: "Request parameters for generating multiple palettes in batch"
  })
)

export const BatchRequest = Schema.decodeUnknown(BatchRequestSchema)
export type BatchRequest = typeof BatchRequestSchema.Type
