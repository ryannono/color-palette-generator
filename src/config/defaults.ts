/**
 * Single source of truth for all configuration defaults
 *
 * This file contains both production and test defaults in one place,
 * making it easy to see and modify configuration for any environment.
 *
 * To change production config: edit CONFIG_DEFAULTS.production
 * To change test config: edit CONFIG_DEFAULTS.test
 */

import type { ColorSpace } from "../schemas/color.js"

/**
 * Configuration structure
 */
export interface ConfigDefaults {
  readonly patternSource: string
  readonly defaultOutputFormat: ColorSpace
  readonly defaultPaletteName: string
  readonly maxConcurrency: number
}

/**
 * All configuration defaults for production and test environments
 *
 * This is the single source of truth for all config values.
 */
export const CONFIG_DEFAULTS = {
  /**
   * Production configuration
   *
   * Used when running the CLI in production/normal mode
   */
  production: {
    patternSource: "patterns/default.json",
    defaultOutputFormat: "hex" as const,
    defaultPaletteName: "generated",
    maxConcurrency: 3
  },

  /**
   * Test configuration
   *
   * Used in test environments for predictable, isolated testing
   */
  test: {
    patternSource: "test/fixtures/valid-palettes/example-orange.json",
    defaultOutputFormat: "hex" as const,
    defaultPaletteName: "generated",
    maxConcurrency: 3
  }
} as const

/**
 * Type guard to ensure config matches expected structure
 */
export const isValidColorSpace = (value: string): value is ColorSpace => {
  return ["hex", "rgb", "oklch", "oklab"].includes(value)
}
