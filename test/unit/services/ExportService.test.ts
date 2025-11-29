/**
 * Tests for ExportService
 */

import { FileSystem, Path } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, ParseResult, Schema } from "effect"
import { vi } from "vitest"
import { MainTest } from "../../../src/layers/MainTest.js"
import { ExportError, ExportService, JSONPath } from "../../../src/services/ExportService/index.js"
import {
  type BatchResult,
  ISOTimestampSchema,
  type PaletteResult
} from "../../../src/services/PaletteService/palette.schema.js"

import clipboardy from "clipboardy"

// Mock clipboardy
vi.mock("clipboardy", () => ({
  default: {
    write: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue("")
  }
}))

describe("ExportService", () => {
  // Sample palette for testing
  const samplePalette: PaletteResult = {
    name: "test-palette",
    outputFormat: "hex",
    inputColor: "#2D72D2",
    anchorStop: 500,
    stops: [
      {
        position: 100,
        color: { l: 0.9, c: 0.1, h: 250, alpha: 1 },
        value: "#d4e7ff"
      },
      {
        position: 500,
        color: { l: 0.5, c: 0.15, h: 250, alpha: 1 },
        value: "#2D72D2"
      },
      {
        position: 1000,
        color: { l: 0.2, c: 0.08, h: 250, alpha: 1 },
        value: "#0e2844"
      }
    ]
  }

  // Sample batch for testing
  const sampleBatch: BatchResult = {
    groupName: "test-batch",
    outputFormat: "hex",
    palettes: [samplePalette],
    failures: [],
    generatedAt: Schema.decodeSync(ISOTimestampSchema)(
      new Date().toISOString()
    )
  }

  describe("exportPalette", () => {
    it.effect("should export palette to JSON file", () =>
      Effect.gen(function*() {
        const service = yield* ExportService
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const testPath = path.join("test", "output", "test-export.json")
        const validatedPath = yield* JSONPath(testPath)

        // Export to file
        yield* service.exportPalette(samplePalette, {
          target: "json",
          jsonPath: validatedPath
        })

        // Verify file was created
        const fileExists = yield* fs.exists(testPath)
        expect(fileExists).toBe(true)

        // Verify content
        const content = yield* fs.readFileString(testPath)
        const parsed = JSON.parse(content)
        expect(parsed.name).toBe("test-palette")
        expect(parsed.stops).toHaveLength(3)

        // Clean up
        yield* fs.remove(testPath, { recursive: true })
      }).pipe(Effect.provide(MainTest)))

    it.effect("should export palette to clipboard", () =>
      Effect.gen(function*() {
        const service = yield* ExportService

        // Export to clipboard
        yield* service.exportPalette(samplePalette, {
          target: "clipboard"
        })

        // Verify clipboard was called
        expect(clipboardy.write).toHaveBeenCalled()
        const writeCall = vi.mocked(clipboardy.write)
        const lastCall = writeCall.mock.calls[writeCall.mock.calls.length - 1]
        const json = lastCall[0] as string
        const parsed = JSON.parse(json)
        expect(parsed.name).toBe("test-palette")
      }).pipe(Effect.provide(MainTest)))

    it.effect("should do nothing when target is 'none'", () =>
      Effect.gen(function*() {
        const service = yield* ExportService

        // Should not throw
        yield* service.exportPalette(samplePalette, {
          target: "none"
        })
      }).pipe(Effect.provide(MainTest)))

    it.effect(
      "should fail with ExportError when jsonPath is missing for json target",
      () =>
        Effect.gen(function*() {
          const service = yield* ExportService
          const result = yield* Effect.either(
            service.exportPalette(samplePalette, {
              target: "json"
            })
          )

          expect(Either.isLeft(result)).toBe(true)
          if (Either.isLeft(result)) {
            expect(result.left).toBeInstanceOf(ExportError)
            expect(result.left.message).toContain("Invalid JSON path:")
          }
        }).pipe(Effect.provide(MainTest))
    )

    it.effect("should fail with ParseError for invalid file path", () =>
      Effect.gen(function*() {
        const service = yield* ExportService
        const result = yield* Effect.either(
          Effect.flatMap(JSONPath("/invalid/\0/path.json"), (validatedPath) =>
            service.exportPalette(samplePalette, {
              target: "json",
              jsonPath: validatedPath
            }))
        )

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(ParseResult.ParseError)
        }
      }).pipe(Effect.provide(MainTest)))
  })

  describe("exportBatch", () => {
    it.effect("should export batch to JSON file", () =>
      Effect.gen(function*() {
        const service = yield* ExportService
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const testPath = path.join("test", "output", "test-batch-export.json")
        const validatedPath = yield* JSONPath(testPath)

        // Export to file
        yield* service.exportBatch(sampleBatch, {
          target: "json",
          jsonPath: validatedPath
        })

        // Verify file was created
        const fileExists = yield* fs.exists(testPath)
        expect(fileExists).toBe(true)

        // Verify content
        const content = yield* fs.readFileString(testPath)
        const parsed = JSON.parse(content)
        expect(parsed.groupName).toBe("test-batch")
        expect(parsed.palettes).toHaveLength(1)

        // Clean up
        yield* fs.remove(testPath, { recursive: true })
      }).pipe(Effect.provide(MainTest)))

    it.effect("should export batch to clipboard", () =>
      Effect.gen(function*() {
        const service = yield* ExportService

        // Export to clipboard
        yield* service.exportBatch(sampleBatch, {
          target: "clipboard"
        })

        // Verify clipboard was called
        expect(clipboardy.write).toHaveBeenCalled()
        const writeCall = vi.mocked(clipboardy.write)
        const lastCall = writeCall.mock.calls[writeCall.mock.calls.length - 1]
        const json = lastCall[0] as string
        const parsed = JSON.parse(json)
        expect(parsed.groupName).toBe("test-batch")
      }).pipe(Effect.provide(MainTest)))

    it.effect("should do nothing when target is 'none'", () =>
      Effect.gen(function*() {
        const service = yield* ExportService

        // Should not throw
        yield* service.exportBatch(sampleBatch, {
          target: "none"
        })
      }).pipe(Effect.provide(MainTest)))

    it.effect(
      "should fail with ExportError when jsonPath is missing for json target",
      () =>
        Effect.gen(function*() {
          const service = yield* ExportService
          const result = yield* Effect.either(
            service.exportBatch(sampleBatch, {
              target: "json"
            })
          )

          expect(Either.isLeft(result)).toBe(true)
          if (Either.isLeft(result)) {
            expect(result.left).toBeInstanceOf(ExportError)
            expect(result.left.message).toContain("Invalid JSON path:")
          }
        }).pipe(Effect.provide(MainTest))
    )
  })
})
