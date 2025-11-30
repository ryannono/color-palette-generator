/**
 * Integration tests for SinglePalette interactive workflow
 *
 * Tests that completeSinglePaletteInput correctly prompts for missing fields
 * using scripted PromptService responses.
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option as O } from "effect"
import {
  decodeSinglePalettePartial,
  type SinglePalettePartial
} from "../../../src/cli/commands/generate/inputSpecs/singlePalette.input.js"
import {
  buildPartialFromOptions,
  completeSinglePaletteInput
} from "../../../src/cli/commands/generate/workflows/singlePalette.workflow.js"
import { MainTest } from "../../../src/layers/MainTest.js"
import { ConfigService } from "../../../src/services/ConfigService.js"
import { CancelledError, PromptService } from "../../../src/services/PromptService/index.js"

describe("SinglePalette Interactive Workflow", () => {
  describe("completeSinglePaletteInput", () => {
    it.effect("should prompt for missing color", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSinglePalettePartial({
          stop: 500,
          format: "hex",
          name: "test-palette",
          pattern: appConfig.patternSource
        })

        const result = yield* completeSinglePaletteInput(partial, appConfig.patternSource)

        expect(result.color).toBe("#2D72D2")
        expect(result.stop).toBe(500)
        expect(result.format).toBe("hex")
        expect(result.name).toBe("test-palette")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["#2D72D2"],
              selectResponses: [],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should prompt for missing stop", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSinglePalettePartial({
          color: "#2D72D2",
          format: "hex",
          name: "test-palette",
          pattern: appConfig.patternSource
        })

        const result = yield* completeSinglePaletteInput(partial, appConfig.patternSource)

        expect(result.color).toBe("#2D72D2")
        expect(result.stop).toBe(600)
        expect(result.format).toBe("hex")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [600],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should prompt for missing format", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSinglePalettePartial({
          color: "#2D72D2",
          stop: 500,
          name: "test-palette",
          pattern: appConfig.patternSource
        })

        const result = yield* completeSinglePaletteInput(partial, appConfig.patternSource)

        expect(result.format).toBe("oklch")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: [],
              selectResponses: ["oklch"],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should prompt for missing name with default", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSinglePalettePartial({
          color: "#2D72D2",
          stop: 500,
          format: "hex",
          pattern: appConfig.patternSource
        })

        const result = yield* completeSinglePaletteInput(partial, appConfig.patternSource)

        expect(result.name).toBe("my-custom-palette")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["my-custom-palette"],
              selectResponses: [],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should prompt for all missing fields in correct order", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSinglePalettePartial({
          pattern: appConfig.patternSource
        })

        const result = yield* completeSinglePaletteInput(partial, appConfig.patternSource)

        expect(result.color).toBe("#DB2C6F")
        expect(result.stop).toBe(700)
        expect(result.format).toBe("rgb")
        expect(result.name).toBe("full-prompt-test")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["#DB2C6F", "full-prompt-test"],
              selectResponses: [700, "rgb"],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should fail when text responses exhausted", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSinglePalettePartial({
          stop: 500,
          format: "hex",
          name: "test",
          pattern: appConfig.patternSource
        })

        const error = yield* Effect.flip(completeSinglePaletteInput(partial, appConfig.patternSource))

        expect(error).toBeInstanceOf(CancelledError)
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should fail when select responses exhausted", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSinglePalettePartial({
          color: "#2D72D2",
          format: "hex",
          name: "test",
          pattern: appConfig.patternSource
        })

        const error = yield* Effect.flip(completeSinglePaletteInput(partial, appConfig.patternSource))

        expect(error).toBeInstanceOf(CancelledError)
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should use pattern from context when not provided", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial: SinglePalettePartial = {
          color: "#2D72D2",
          stop: 500,
          format: "hex",
          name: "test"
        }

        const result = yield* completeSinglePaletteInput(partial, appConfig.patternSource)

        expect(result.pattern).toBe(appConfig.patternSource)
      }).pipe(Effect.provide(MainTest)))
  })

  describe("buildPartialFromOptions", () => {
    it("should convert all Some options to values", () => {
      const result = buildPartialFromOptions({
        colorOpt: O.some("#2D72D2"),
        stopOpt: O.some(500),
        formatOpt: O.some("hex"),
        nameOpt: O.some("test"),
        patternOpt: O.some("/path/to/pattern")
      })

      expect(result.color).toBe("#2D72D2")
      expect(result.stop).toBe(500)
      expect(result.format).toBe("hex")
      expect(result.name).toBe("test")
      expect(result.pattern).toBe("/path/to/pattern")
    })

    it("should convert all None options to undefined", () => {
      const result = buildPartialFromOptions({
        colorOpt: O.none(),
        stopOpt: O.none(),
        formatOpt: O.none(),
        nameOpt: O.none(),
        patternOpt: O.none()
      })

      expect(result.color).toBeUndefined()
      expect(result.stop).toBeUndefined()
      expect(result.format).toBeUndefined()
      expect(result.name).toBeUndefined()
      expect(result.pattern).toBeUndefined()
    })

    it("should refine invalid stop to undefined", () => {
      const result = buildPartialFromOptions({
        colorOpt: O.some("#2D72D2"),
        stopOpt: O.some(999),
        formatOpt: O.some("hex"),
        nameOpt: O.some("test"),
        patternOpt: O.none()
      })

      expect(result.stop).toBeUndefined()
    })

    it("should refine invalid format to undefined", () => {
      const result = buildPartialFromOptions({
        colorOpt: O.some("#2D72D2"),
        stopOpt: O.some(500),
        formatOpt: O.some("invalid-format"),
        nameOpt: O.some("test"),
        patternOpt: O.none()
      })

      expect(result.format).toBeUndefined()
    })
  })
})
