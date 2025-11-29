/**
 * Tests for PaletteService
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { MainTest } from "../../../src/layers/MainTest.js"
import { ConfigService } from "../../../src/services/ConfigService.js"
import { PaletteGenerationError, PaletteService } from "../../../src/services/PaletteService/index.js"

describe("PaletteService", () => {
  describe("generate", () => {
    it.effect("should generate a palette with hex output", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        const result = yield* service.generate({
          inputColor: "#2D72D2",
          anchorStop: 500,
          outputFormat: "hex",
          paletteName: "test-blue",
          patternSource
        })

        // Verify basic structure
        expect(result.name).toBe("test-blue")
        expect(result.inputColor).toBe("#2D72D2")
        expect(result.anchorStop).toBe(500)
        expect(result.outputFormat).toBe("hex")
        expect(result.stops).toHaveLength(10)

        // Verify all stops have required properties
        result.stops.forEach((stop) => {
          expect(stop.position).toBeGreaterThanOrEqual(100)
          expect(stop.position).toBeLessThanOrEqual(1000)
          expect(stop.value).toMatch(/^#[0-9a-f]{6}$/i)
          expect(stop.color).toHaveProperty("l")
          expect(stop.color).toHaveProperty("c")
          expect(stop.color).toHaveProperty("h")
        })

        // Verify stops are sorted by position
        for (let i = 0; i < result.stops.length - 1; i++) {
          expect(result.stops[i].position).toBeLessThan(
            result.stops[i + 1].position
          )
        }
      }).pipe(Effect.provide(MainTest)))

    it.effect("should generate a palette with rgb output", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        const result = yield* service.generate({
          inputColor: "#FF5733",
          anchorStop: 500,
          outputFormat: "rgb",
          paletteName: "test-orange",
          patternSource
        })

        expect(result.outputFormat).toBe("rgb")
        expect(result.stops).toHaveLength(10)

        // Verify RGB format
        result.stops.forEach((stop) => {
          expect(stop.value).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
        })
      }).pipe(Effect.provide(MainTest)))

    it.effect("should generate a palette with oklch output", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        const result = yield* service.generate({
          inputColor: "#10B981",
          anchorStop: 500,
          outputFormat: "oklch",
          paletteName: "test-green",
          patternSource
        })

        expect(result.outputFormat).toBe("oklch")
        expect(result.stops).toHaveLength(10)

        // Verify OKLCH format
        result.stops.forEach((stop) => {
          expect(stop.value).toMatch(/^oklch\([\d.]+% [\d.]+ [\d.]+\)$/)
        })
      }).pipe(Effect.provide(MainTest)))

    it.effect("should generate a palette with oklab output", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        const result = yield* service.generate({
          inputColor: "#8B5CF6",
          anchorStop: 500,
          outputFormat: "oklab",
          paletteName: "test-purple",
          patternSource
        })

        expect(result.outputFormat).toBe("oklab")
        expect(result.stops).toHaveLength(10)

        // Verify OKLAB format
        result.stops.forEach((stop) => {
          expect(stop.value).toMatch(/^oklab\([\d.]+% -?[\d.]+ -?[\d.]+\)$/)
        })
      }).pipe(Effect.provide(MainTest)))

    it.effect("should support different anchor stops", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        // Test with anchor at 300
        const result300 = yield* service.generate({
          inputColor: "#2D72D2",
          anchorStop: 300,
          outputFormat: "hex",
          paletteName: "test-300",
          patternSource
        })

        // Test with anchor at 700
        const result700 = yield* service.generate({
          inputColor: "#2D72D2",
          anchorStop: 700,
          outputFormat: "hex",
          paletteName: "test-700",
          patternSource
        })

        expect(result300.anchorStop).toBe(300)
        expect(result700.anchorStop).toBe(700)

        // Both should have 10 stops
        expect(result300.stops).toHaveLength(10)
        expect(result700.stops).toHaveLength(10)

        // The anchor stop should exist in both
        expect(result300.stops.some((s) => s.position === 300)).toBe(true)
        expect(result700.stops.some((s) => s.position === 700)).toBe(true)
      }).pipe(Effect.provide(MainTest)))

    it.effect(
      "should use config default pattern source when not specified",
      () =>
        Effect.gen(function*() {
          const service = yield* PaletteService
          const config = yield* ConfigService
          const patternSource = yield* config.getPatternSource()

          // Don't specify patternSource - should use config default
          const result = yield* service.generate({
            inputColor: "#2D72D2",
            anchorStop: 500,
            outputFormat: "hex",
            paletteName: "test-default-pattern",
            patternSource
          })

          expect(result.stops).toHaveLength(10)
        }).pipe(Effect.provide(MainTest))
    )

    it.effect("should fail with PaletteGenerationError for invalid color", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        const error = yield* service
          .generate({
            inputColor: "not-a-color",
            anchorStop: 500,
            outputFormat: "hex",
            paletteName: "test-invalid",
            patternSource
          })
          .pipe(Effect.flip)

        expect(error).toBeInstanceOf(PaletteGenerationError)
        expect(error.message).toContain("Failed to generate palette")
      }).pipe(Effect.provide(MainTest)))

    it.effect(
      "should fail with PaletteGenerationError for invalid pattern source",
      () =>
        Effect.gen(function*() {
          const service = yield* PaletteService

          const error = yield* service
            .generate({
              inputColor: "#2D72D2",
              anchorStop: 500,
              outputFormat: "hex",
              paletteName: "test-invalid-pattern",
              patternSource: "nonexistent-pattern.json"
            })
            .pipe(Effect.flip)

          expect(error).toBeInstanceOf(PaletteGenerationError)
        }).pipe(Effect.provide(MainTest))
    )
  })

  describe("generateBatch", () => {
    it.effect("should generate multiple palettes in batch", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        const result = yield* service.generateBatch({
          paletteGroupName: "test-batch",
          outputFormat: "hex",
          pairs: [
            { color: "#2D72D2", stop: 500 },
            { color: "#FF5733", stop: 500 },
            { color: "#10B981", stop: 500 }
          ],
          patternSource
        })

        expect(result.groupName).toBe("test-batch")
        expect(result.outputFormat).toBe("hex")
        expect(result.palettes).toHaveLength(3)
        expect(result.failures).toHaveLength(0)
        expect(result.generatedAt).toBeTruthy()

        // Verify each palette
        result.palettes.forEach((palette) => {
          expect(palette.stops).toHaveLength(10)
          expect(palette.outputFormat).toBe("hex")
        })
      }).pipe(Effect.provide(MainTest)))

    it.effect("should handle partial failures in batch", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        const result = yield* service.generateBatch({
          paletteGroupName: "test-partial",
          outputFormat: "hex",
          pairs: [
            { color: "#2D72D2", stop: 500 },
            { color: "invalid-color", stop: 500 }, // This will fail
            { color: "#10B981", stop: 500 }
          ],
          patternSource
        })

        expect(result.groupName).toBe("test-partial")
        expect(result.palettes.length).toBeLessThan(3) // Not all succeeded
        expect(result.failures.length).toBeGreaterThan(0) // Has failures
        expect(result.palettes.length).toBeGreaterThan(0) // At least some succeeded
      }).pipe(Effect.provide(MainTest)))

    it.effect(
      "should capture failure details with color, stop, and error message",
      () =>
        Effect.gen(function*() {
          const service = yield* PaletteService
          const config = yield* ConfigService
          const patternSource = yield* config.getPatternSource()

          const result = yield* service.generateBatch({
            paletteGroupName: "test-failure-details",
            outputFormat: "hex",
            pairs: [
              { color: "#2D72D2", stop: 500 },
              { color: "not-a-valid-color", stop: 700 } // This will fail
            ],
            patternSource
          })

          // Should have one success and one failure
          expect(result.palettes).toHaveLength(1)
          expect(result.failures).toHaveLength(1)

          // Verify failure details
          const failure = result.failures[0]
          expect(failure.color).toBe("not-a-valid-color")
          expect(failure.stop).toBe(700)
          expect(failure.error).toContain(
            "Failed to generate palette for not-a-valid-color"
          )
          // Error should include the underlying cause
          expect(failure.error).toContain("Could not parse color string")
        }).pipe(Effect.provide(MainTest))
    )

    it.effect(
      "should fail with PaletteGenerationError when all batch items fail",
      () =>
        Effect.gen(function*() {
          const service = yield* PaletteService
          const config = yield* ConfigService
          const patternSource = yield* config.getPatternSource()

          const error = yield* service
            .generateBatch({
              paletteGroupName: "test-all-fail",
              outputFormat: "hex",
              pairs: [
                { color: "invalid-1", stop: 500 },
                { color: "invalid-2", stop: 500 },
                { color: "invalid-3", stop: 500 }
              ],
              patternSource
            })
            .pipe(Effect.flip)

          expect(error).toBeInstanceOf(PaletteGenerationError)
          expect(error.message).toContain("All palette generations failed")
          expect(error.message).toContain("invalid-1")
          expect(error.message).toContain("invalid-2")
          expect(error.message).toContain("invalid-3")
        }).pipe(Effect.provide(MainTest))
    )

    it.effect("should extract nested error causes in failure messages", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService

        // Use an invalid pattern source to trigger a nested error chain
        const error = yield* service
          .generate({
            inputColor: "#2D72D2",
            anchorStop: 500,
            outputFormat: "hex",
            paletteName: "test",
            patternSource: "/nonexistent/path/to/pattern.json"
          })
          .pipe(Effect.flip)

        expect(error).toBeInstanceOf(PaletteGenerationError)
        // The error message should contain the wrapped message AND the underlying cause
        expect(error.message).toContain("Failed to generate palette")
        // Should have nested cause information about file not found
        expect(error.message.length).toBeGreaterThan(50) // Indicates nested messages
      }).pipe(Effect.provide(MainTest)))

    it.effect("should support different output formats in batch", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService
        const config = yield* ConfigService
        const patternSource = yield* config.getPatternSource()

        const resultRgb = yield* service.generateBatch({
          paletteGroupName: "test-rgb-batch",
          outputFormat: "rgb",
          pairs: [
            { color: "#2D72D2", stop: 500 },
            { color: "#FF5733", stop: 600 }
          ],
          patternSource
        })

        expect(resultRgb.outputFormat).toBe("rgb")
        resultRgb.palettes.forEach((palette) => {
          expect(palette.outputFormat).toBe("rgb")
          palette.stops.forEach((stop) => {
            expect(stop.value).toMatch(/^rgb\(/)
          })
        })
      }).pipe(Effect.provide(MainTest)))

    it.effect("should use custom pattern source in batch", () =>
      Effect.gen(function*() {
        const service = yield* PaletteService

        const result = yield* service.generateBatch({
          paletteGroupName: "test-custom-pattern",
          outputFormat: "hex",
          pairs: [
            { color: "#2D72D2", stop: 500 },
            { color: "#FF5733", stop: 500 }
          ],
          patternSource: "test/fixtures/valid-palettes/example-orange.json"
        })

        expect(result.palettes).toHaveLength(2)
        expect(result.failures).toHaveLength(0)
      }).pipe(Effect.provide(MainTest)))
  })
})
