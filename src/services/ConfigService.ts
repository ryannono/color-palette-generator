/**
 * Configuration service for application-wide settings
 *
 * Provides centralized configuration including:
 * - Pattern source paths
 * - Default output formats
 * - Default palette names
 *
 * Configuration can be overridden via environment variables:
 * - PATTERN_SOURCE: Custom pattern file path
 * - DEFAULT_OUTPUT_FORMAT: Custom output format
 * - DEFAULT_PALETTE_NAME: Custom palette name
 * - MAX_CONCURRENCY: Custom concurrency limit
 *
 * All defaults are defined in src/config/defaults.ts (single source of truth)
 */

import { Config, Effect } from "effect"
import { CONFIG_DEFAULTS, isValidColorSpace } from "../config/defaults.js"
import type { ColorSpace } from "../schemas/color.js"

/**
 * Application configuration
 */
export interface AppConfig {
  readonly patternSource: string
  readonly defaultOutputFormat: ColorSpace
  readonly defaultPaletteName: string
  readonly maxConcurrency: number
}

/**
 * Effect.Config definitions for each configuration field
 */
const patternSourceConfig = Config.string("PATTERN_SOURCE").pipe(
  Config.withDefault(CONFIG_DEFAULTS.production.patternSource)
)

const defaultOutputFormatConfig = Config.string("DEFAULT_OUTPUT_FORMAT").pipe(
  Config.withDefault(CONFIG_DEFAULTS.production.defaultOutputFormat),
  Config.validate({
    message: "Invalid color space. Must be one of: hex, rgb, oklch, oklab",
    validation: isValidColorSpace
  })
)

const defaultPaletteNameConfig = Config.string("DEFAULT_PALETTE_NAME").pipe(
  Config.withDefault(CONFIG_DEFAULTS.production.defaultPaletteName)
)

const maxConcurrencyConfig = Config.integer("MAX_CONCURRENCY").pipe(
  Config.withDefault(CONFIG_DEFAULTS.production.maxConcurrency)
)

/**
 * Combined application config
 */
const appConfigConfig = Config.all({
  patternSource: patternSourceConfig,
  defaultOutputFormat: defaultOutputFormatConfig,
  defaultPaletteName: defaultPaletteNameConfig,
  maxConcurrency: maxConcurrencyConfig
})

/**
 * Configuration service using Effect.Service pattern
 *
 * Uses Effect.Config for declarative configuration with validation.
 * All defaults come from CONFIG_DEFAULTS (single source of truth).
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const config = yield* ConfigService
 *   const appConfig = yield* config.getConfig()
 *   console.log(appConfig.patternSource)
 * }).pipe(Effect.provide(ConfigService.Default))
 * ```
 */
export class ConfigService extends Effect.Service<ConfigService>()("ConfigService", {
  effect: Effect.gen(function*() {
    // Load config once at service initialization
    const config = yield* appConfigConfig

    return {
      /**
       * Get complete application configuration
       */
      getConfig: (): Effect.Effect<AppConfig> => Effect.succeed(config),

      /**
       * Get pattern source path
       * Convenience method for accessing just the pattern source
       */
      getPatternSource: (): Effect.Effect<string> => Effect.succeed(config.patternSource)
    }
  })
}) {
  /**
   * Test layer with fixed configuration for testing
   *
   * Provides a predictable configuration without relying on environment variables.
   * All test defaults come from CONFIG_DEFAULTS.test (single source of truth).
   */
  static readonly Test = Effect.Service<ConfigService>()("ConfigService", {
    effect: Effect.succeed({
      getConfig: (): Effect.Effect<AppConfig> => Effect.succeed(CONFIG_DEFAULTS.test),
      getPatternSource: (): Effect.Effect<string> => Effect.succeed(CONFIG_DEFAULTS.test.patternSource)
    })
  }).Default
}
