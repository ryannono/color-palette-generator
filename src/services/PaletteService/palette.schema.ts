/**
 * Palette generation schemas
 *
 * Request and result schemas for single and batch palette generation.
 */

import { Schema } from "effect"
import { DEFAULT_BATCH_NAME, DEFAULT_PALETTE_NAME } from "../../config/constants.js"
import { ColorSpaceSchema, ColorStringSchema } from "../../domain/color/color.schema.js"
import { PaletteStopSchema, StopPositionSchema } from "../../domain/palette/palette.schema.js"

// ============================================================================
// Common Schema Combinators
// ============================================================================

const NonEmptyString = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.annotations({
    identifier: "NonEmptyString",
    description: "A string that cannot be empty"
  })
)

/** Validated ISO 8601 timestamp */
export const ISOTimestampSchema = Schema.String.pipe(
  Schema.filter(
    (s) => !isNaN(Date.parse(s)),
    { message: () => "Invalid ISO 8601 timestamp" }
  ),
  Schema.brand("ISOTimestamp"),
  Schema.annotations({
    identifier: "ISOTimestamp",
    description: "ISO 8601 timestamp"
  })
)

export const ISOTimestamp = Schema.decodeUnknown(ISOTimestampSchema)
export type ISOTimestamp = typeof ISOTimestampSchema.Type

const OptionalPatternSource = Schema.optional(Schema.String)

// ============================================================================
// Single Palette
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
})

export const PaletteRequest = Schema.decodeUnknown(PaletteRequestSchema)
export type PaletteRequest = typeof PaletteRequestSchema.Type

/** A palette stop with its formatted output value */
export const FormattedStopSchema = PaletteStopSchema.pipe(
  Schema.extend(Schema.Struct({ value: Schema.String }))
)

export const FormattedStop = Schema.decodeUnknown(FormattedStopSchema)
export type FormattedStop = typeof FormattedStopSchema.Type

/** Generated palette with formatted color values */
export const PaletteResultSchema = Schema.Struct({
  name: NonEmptyString,
  inputColor: ColorStringSchema,
  anchorStop: StopPositionSchema,
  outputFormat: ColorSpaceSchema,
  stops: Schema.Array(FormattedStopSchema).pipe(Schema.itemsCount(10))
})

export const PaletteResult = Schema.decodeUnknown(PaletteResultSchema)
export type PaletteResult = typeof PaletteResultSchema.Type

// ============================================================================
// Batch Palette
// ============================================================================

/** Color with its anchor stop position */
export const ColorAnchorSchema = Schema.Struct({
  color: ColorStringSchema,
  stop: StopPositionSchema
})

export const ColorAnchor = Schema.decodeUnknown(ColorAnchorSchema)
export type ColorAnchor = typeof ColorAnchorSchema.Type

/** Request to generate multiple palettes */
export const BatchRequestSchema = Schema.Struct({
  pairs: Schema.Array(ColorAnchorSchema).pipe(Schema.minItems(1)),
  outputFormat: ColorSpaceSchema,
  paletteGroupName: Schema.optionalWith(Schema.String, {
    default: () => DEFAULT_BATCH_NAME
  }),
  patternSource: OptionalPatternSource
})

export const BatchRequest = Schema.decodeUnknown(BatchRequestSchema)
export type BatchRequest = typeof BatchRequestSchema.Type

/** Collection of generated palettes with metadata */
export const BatchResultSchema = Schema.Struct({
  groupName: NonEmptyString,
  outputFormat: ColorSpaceSchema,
  generatedAt: ISOTimestampSchema,
  palettes: Schema.Array(PaletteResultSchema).pipe(Schema.minItems(1)),
  partial: Schema.optionalWith(Schema.Boolean, { default: () => false })
})

export const BatchResult = Schema.decodeUnknown(BatchResultSchema)
export type BatchResult = typeof BatchResultSchema.Type
