/**
 * Integration tests for BatchPalettes interactive workflow
 *
 * Tests that completeBatchPalettesInput correctly prompts for missing fields
 * using scripted PromptService responses.
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option as O } from "effect"
import {
  type BatchPalettesPartial,
  decodeBatchPalettesPartial
} from "../../../src/cli/commands/generate/inputSpecs/batchPalettes.input.js"
import {
  buildBatchPartialFromPairs,
  completeBatchPalettesInput
} from "../../../src/cli/commands/generate/workflows/batch.workflow.js"
import { MainTest } from "../../../src/layers/MainTest.js"
import { ConfigService } from "../../../src/services/ConfigService.js"
import { CancelledError, PromptService } from "../../../src/services/PromptService/index.js"

describe("BatchPalettes Interactive Workflow", () => {
  describe("completeBatchPalettesInput", () => {
    it.effect("should prompt for missing stop in pair", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchPalettesPartial({
          pairs: [{ color: "#2D72D2" }],
          format: "hex",
          name: "batch-test",
          pattern: appConfig.patternSource
        })

        const result = yield* completeBatchPalettesInput(partial, appConfig.patternSource, "default")

        expect(result.pairs).toHaveLength(1)
        expect(result.pairs[0].stop).toBe(500)
        expect(result.pairs[0].color).toBe("#2D72D2")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [500],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should prompt for missing stops in multiple pairs", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchPalettesPartial({
          pairs: [
            { color: "#2D72D2" },
            { color: "#DB2C6F" }
          ],
          format: "hex",
          name: "batch-test",
          pattern: appConfig.patternSource
        })

        const result = yield* completeBatchPalettesInput(partial, appConfig.patternSource, "default")

        expect(result.pairs).toHaveLength(2)
        expect(result.pairs[0].stop).toBe(500)
        expect(result.pairs[1].stop).toBe(600)
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [500, 600],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should not prompt for pairs with stop already set", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchPalettesPartial({
          pairs: [
            { color: "#2D72D2", stop: 400 },
            { color: "#DB2C6F" }
          ],
          format: "hex",
          name: "batch-test",
          pattern: appConfig.patternSource
        })

        const result = yield* completeBatchPalettesInput(partial, appConfig.patternSource, "default")

        expect(result.pairs[0].stop).toBe(400)
        expect(result.pairs[1].stop).toBe(700)
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [700],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should prompt for missing format", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchPalettesPartial({
          pairs: [{ color: "#2D72D2", stop: 500 }],
          name: "batch-test",
          pattern: appConfig.patternSource
        })

        const result = yield* completeBatchPalettesInput(partial, appConfig.patternSource, "default")

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

        const partial = yield* decodeBatchPalettesPartial({
          pairs: [{ color: "#2D72D2", stop: 500 }],
          format: "hex",
          pattern: appConfig.patternSource
        })

        const result = yield* completeBatchPalettesInput(partial, appConfig.patternSource, "my-default")

        expect(result.name).toBe("prompted-name")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["prompted-name"],
              selectResponses: [],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should prompt for all missing fields", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial: BatchPalettesPartial = {
          pairs: [
            { color: "#2D72D2" },
            { color: "#DB2C6F" }
          ]
        }

        const result = yield* completeBatchPalettesInput(partial, appConfig.patternSource, "default")

        expect(result.pairs[0].stop).toBe(500)
        expect(result.pairs[1].stop).toBe(600)
        expect(result.format).toBe("rgb")
        expect(result.name).toBe("full-test")
        expect(result.pattern).toBe(appConfig.patternSource)
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["full-test"],
              selectResponses: [500, 600, "rgb"],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should fail when select responses exhausted", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchPalettesPartial({
          pairs: [
            { color: "#2D72D2" },
            { color: "#DB2C6F" }
          ],
          format: "hex",
          name: "test",
          pattern: appConfig.patternSource
        })

        const error = yield* Effect.flip(completeBatchPalettesInput(partial, appConfig.patternSource, "default"))

        expect(error).toBeInstanceOf(CancelledError)
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [500],
              confirmResponses: []
            })
          )
        )
      ))
  })

  describe("buildBatchPartialFromPairs", () => {
    it("should build partial with all options provided", () => {
      const result = buildBatchPartialFromPairs(
        [
          { color: "#2D72D2", stop: 500 },
          { color: "#DB2C6F", stop: 600 }
        ],
        {
          formatOpt: O.some("hex"),
          nameOpt: O.some("test"),
          patternOpt: O.some("/path/to/pattern")
        }
      )

      expect(result.pairs).toHaveLength(2)
      expect(result.format).toBe("hex")
      expect(result.name).toBe("test")
      expect(result.pattern).toBe("/path/to/pattern")
    })

    it("should build partial with missing options as undefined", () => {
      const result = buildBatchPartialFromPairs(
        [{ color: "#2D72D2", stop: undefined }],
        {
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none()
        }
      )

      expect(result.pairs[0].stop).toBeUndefined()
      expect(result.format).toBeUndefined()
      expect(result.name).toBeUndefined()
      expect(result.pattern).toBeUndefined()
    })

    it("should refine invalid format to undefined", () => {
      const result = buildBatchPartialFromPairs(
        [{ color: "#2D72D2", stop: 500 }],
        {
          formatOpt: O.some("invalid"),
          nameOpt: O.some("test"),
          patternOpt: O.none()
        }
      )

      expect(result.format).toBeUndefined()
    })
  })
})
