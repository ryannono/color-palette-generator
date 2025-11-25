/**
 * Tests for PatternService
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"
import { PatternLoadError, PatternService } from "../../../src/services/PatternService.js"

describe("PatternService", () => {
  it.effect("should load pattern from file", () =>
    Effect.gen(function*() {
      const service = yield* PatternService
      const pattern = yield* service.loadPattern("test/fixtures/palettes/example-blue.json")

      expect(pattern.referenceStop).toBe(500)
      expect(pattern.name).toContain("smoothed")
      expect(pattern.transforms[500].lightnessMultiplier).toBe(1.0)
      expect(pattern.metadata.sourceCount).toBe(1)
    }).pipe(Effect.provide(PatternService.Default)))

  it.effect("should load palette from file", () =>
    Effect.gen(function*() {
      const service = yield* PatternService
      const palette = yield* service.loadPalette("test/fixtures/palettes/example-blue.json")

      expect(palette.name).toBe("example-blue")
      expect(palette.stops).toHaveLength(10)
      expect(palette.stops[0].position).toBe(100)
      expect(palette.stops[0].color).toHaveProperty("l")
      expect(palette.stops[0].color).toHaveProperty("c")
      expect(palette.stops[0].color).toHaveProperty("h")
    }).pipe(Effect.provide(PatternService.Default)))

  it.effect("should fail with PatternLoadError for missing file", () =>
    Effect.gen(function*() {
      const service = yield* PatternService
      const result = yield* Effect.either(service.loadPattern("nonexistent.json"))

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(PatternLoadError)
        expect(result.left.message).toContain("Failed to read palette file")
      }
    }).pipe(Effect.provide(PatternService.Default)))

  it.effect("should fail with PatternLoadError for invalid JSON", () =>
    Effect.gen(function*() {
      const service = yield* PatternService
      const result = yield* Effect.either(service.loadPattern("test/fixtures/invalid.json"))

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(PatternLoadError)
      }
    }).pipe(Effect.provide(PatternService.Default)))

  it.effect("should smooth pattern transforms", () =>
    Effect.gen(function*() {
      const service = yield* PatternService
      const pattern = yield* service.loadPattern("test/fixtures/palettes/example-blue.json")

      // Check that lightness multipliers are linear
      const lightness = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(
        (stop) => pattern.transforms[stop as keyof typeof pattern.transforms].lightnessMultiplier
      )

      // Lightness should be descending (lighter at 100, darker at 1000)
      for (let i = 0; i < lightness.length - 1; i++) {
        expect(lightness[i]).toBeGreaterThan(lightness[i + 1])
      }

      // Reference stop (500) should be 1.0
      expect(pattern.transforms[500].lightnessMultiplier).toBe(1.0)
    }).pipe(Effect.provide(PatternService.Default)))
})
