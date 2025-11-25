import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { generatePalette } from "../../src/programs/generate-palette.js"
import { GeneratePaletteInput } from "../../src/schemas/generate-palette.js"

describe("Palette Generation Integration", () => {
  it.effect("should generate a complete 10-stop palette from a color", () =>
    Effect.gen(function*() {
      const input = yield* GeneratePaletteInput({
        inputColor: "#2D72D2",
        anchorStop: 500,
        outputFormat: "hex",
        paletteName: "test-blue"
      })

      const result = yield* generatePalette(input)

      // Should have metadata
      expect(result.name).toBe("test-blue")
      expect(result.inputColor).toBe("#2D72D2")
      expect(result.anchorStop).toBe(500)
      expect(result.outputFormat).toBe("hex")

      // Should have 10 stops
      expect(result.stops).toHaveLength(10)

      // Should have all stop positions from 100 to 1000
      const positions = result.stops.map((s) => s.position)
      expect(positions).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])

      // All values should be valid hex colors
      for (const stop of result.stops) {
        expect(stop.value).toMatch(/^#[0-9a-f]{6}$/i)
      }

      // Stop 500 should be close to the input color (allowing for rounding)
      const stop500 = result.stops.find((s) => s.position === 500)
      expect(stop500).toBeDefined()
      expect(stop500!.value.toLowerCase()).toMatch(/^#[2-4][0-9a-f][6-8][0-9a-f]d[0-9a-f]$/i)
    }))

  it.effect("should generate palette with RGB output format", () =>
    Effect.gen(function*() {
      const input = yield* GeneratePaletteInput({
        inputColor: "2D72D2",
        anchorStop: 500,
        outputFormat: "rgb"
      })

      const result = yield* generatePalette(input)

      // Should have RGB format
      expect(result.outputFormat).toBe("rgb")

      // All values should be valid RGB strings
      for (const stop of result.stops) {
        expect(stop.value).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/)
      }
    }))

  it.effect("should generate palette with OKLCH output format", () =>
    Effect.gen(function*() {
      const input = yield* GeneratePaletteInput({
        inputColor: "#2D72D2",
        anchorStop: 700,
        outputFormat: "oklch"
      })

      const result = yield* generatePalette(input)

      // Should have OKLCH format
      expect(result.outputFormat).toBe("oklch")
      expect(result.anchorStop).toBe(700)

      // All values should be valid OKLCH strings
      for (const stop of result.stops) {
        expect(stop.value).toMatch(/^oklch\([^)]+\)$/)
      }
    }))

  it.effect("should use default values for optional fields", () =>
    Effect.gen(function*() {
      const input = yield* GeneratePaletteInput({
        inputColor: "#2D72D2",
        anchorStop: 500,
        outputFormat: "hex"
      })

      const result = yield* generatePalette(input)

      // Should use default palette name
      expect(result.name).toBe("generated")
    }))
})
