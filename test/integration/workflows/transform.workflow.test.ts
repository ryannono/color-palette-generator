/**
 * Integration tests for Transform interactive workflows
 *
 * Tests SingleTransform, ManyTransform, and BatchTransform workflows
 * with scripted PromptService responses.
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option as O } from "effect"
import {
  type BatchTransformPartial,
  decodeBatchTransformPartial
} from "../../../src/cli/commands/generate/inputSpecs/batchTransform.input.js"
import {
  decodeManyTransformPartial,
  type ManyTransformPartial
} from "../../../src/cli/commands/generate/inputSpecs/manyTransform.input.js"
import {
  decodeSingleTransformPartial,
  type SingleTransformPartial
} from "../../../src/cli/commands/generate/inputSpecs/singleTransform.input.js"
import {
  buildBatchTransformPartial,
  buildManyTransformPartial,
  buildSingleTransformPartial,
  completeBatchTransformInput,
  completeManyTransformInput,
  completeSingleTransformInput
} from "../../../src/cli/commands/generate/workflows/transform.workflow.js"
import { MainTest } from "../../../src/layers/MainTest.js"
import { ConfigService } from "../../../src/services/ConfigService.js"
import { CancelledError, PromptService } from "../../../src/services/PromptService/index.js"

describe("Transform Interactive Workflows", () => {
  describe("completeSingleTransformInput", () => {
    it.effect("should prompt for missing stop", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSingleTransformPartial({
          reference: "#2D72D2",
          target: "#238551",
          format: "hex",
          name: "transform-test",
          pattern: appConfig.patternSource
        })

        const result = yield* completeSingleTransformInput(partial, appConfig.patternSource)

        expect(result.stop).toBe(500)
        expect(result.reference).toBe("#2D72D2")
        expect(result.target).toBe("#238551")
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

    it.effect("should prompt for missing format", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSingleTransformPartial({
          reference: "#2D72D2",
          target: "#238551",
          stop: 500,
          name: "transform-test",
          pattern: appConfig.patternSource
        })

        const result = yield* completeSingleTransformInput(partial, appConfig.patternSource)

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

    it.effect("should prompt for missing name", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeSingleTransformPartial({
          reference: "#2D72D2",
          target: "#238551",
          stop: 500,
          format: "hex",
          pattern: appConfig.patternSource
        })

        const result = yield* completeSingleTransformInput(partial, appConfig.patternSource)

        expect(result.name).toBe("custom-transform")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["custom-transform"],
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

        const partial: SingleTransformPartial = {
          reference: "#2D72D2",
          target: "#238551"
        }

        const result = yield* completeSingleTransformInput(partial, appConfig.patternSource)

        expect(result.stop).toBe(600)
        expect(result.format).toBe("rgb")
        expect(result.name).toBe("full-transform")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["full-transform"],
              selectResponses: [600, "rgb"],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should die when reference is missing", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial: SingleTransformPartial = {
          target: "#238551",
          stop: 500,
          format: "hex",
          name: "test",
          pattern: appConfig.patternSource
        }

        const exit = yield* Effect.exit(completeSingleTransformInput(partial, appConfig.patternSource))

        expect(exit._tag).toBe("Failure")
      }).pipe(Effect.provide(MainTest)))

    it.effect("should die when target is missing", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial: SingleTransformPartial = {
          reference: "#2D72D2",
          stop: 500,
          format: "hex",
          name: "test",
          pattern: appConfig.patternSource
        }

        const exit = yield* Effect.exit(completeSingleTransformInput(partial, appConfig.patternSource))

        expect(exit._tag).toBe("Failure")
      }).pipe(Effect.provide(MainTest)))
  })

  describe("completeManyTransformInput", () => {
    it.effect("should prompt for missing stop", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeManyTransformPartial({
          reference: "#BD5200",
          targets: ["#2D72D2", "#238551"],
          format: "hex",
          name: "many-transform",
          pattern: appConfig.patternSource
        })

        const result = yield* completeManyTransformInput(partial, appConfig.patternSource)

        expect(result.stop).toBe(700)
        expect(result.targets).toEqual(["#2D72D2", "#238551"])
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

    it.effect("should prompt for all missing fields", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial: ManyTransformPartial = {
          reference: "#BD5200",
          targets: ["#2D72D2", "#238551", "#DB2C6F"]
        }

        const result = yield* completeManyTransformInput(partial, appConfig.patternSource)

        expect(result.stop).toBe(500)
        expect(result.format).toBe("oklch")
        expect(result.name).toBe("many-test")
        expect(result.targets).toHaveLength(3)
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["many-test"],
              selectResponses: [500, "oklch"],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should die when reference is missing", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial: ManyTransformPartial = {
          targets: ["#2D72D2"],
          stop: 500,
          format: "hex",
          name: "test",
          pattern: appConfig.patternSource
        }

        const exit = yield* Effect.exit(completeManyTransformInput(partial, appConfig.patternSource))

        expect(exit._tag).toBe("Failure")
      }).pipe(Effect.provide(MainTest)))

    it.effect("should die when targets is missing", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial: ManyTransformPartial = {
          reference: "#BD5200",
          stop: 500,
          format: "hex",
          name: "test",
          pattern: appConfig.patternSource
        }

        const exit = yield* Effect.exit(completeManyTransformInput(partial, appConfig.patternSource))

        expect(exit._tag).toBe("Failure")
      }).pipe(Effect.provide(MainTest)))
  })

  describe("completeBatchTransformInput", () => {
    it.effect("should prompt for missing stops in transformations", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchTransformPartial({
          transformations: [
            { reference: "#2D72D2", target: "#238551" },
            { reference: "#BD5200", target: "#DB2C6F" }
          ],
          format: "hex",
          name: "batch-transform",
          pattern: appConfig.patternSource
        })

        const result = yield* completeBatchTransformInput(partial, appConfig.patternSource)

        expect(result.transformations).toHaveLength(2)
        expect(result.transformations[0].stop).toBe(500)
        expect(result.transformations[1].stop).toBe(600)
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

    it.effect("should not prompt for transformations with stop set", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchTransformPartial({
          transformations: [
            { reference: "#2D72D2", target: "#238551", stop: 400 },
            { reference: "#BD5200", target: "#DB2C6F" }
          ],
          format: "hex",
          name: "batch-transform",
          pattern: appConfig.patternSource
        })

        const result = yield* completeBatchTransformInput(partial, appConfig.patternSource)

        expect(result.transformations[0].stop).toBe(400)
        expect(result.transformations[1].stop).toBe(700)
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

    it.effect("should handle mixed single and many transformations", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchTransformPartial({
          transformations: [
            { reference: "#2D72D2", target: "#238551" },
            { reference: "#BD5200", targets: ["#DB2C6F", "#555555"] }
          ],
          format: "hex",
          name: "mixed-batch",
          pattern: appConfig.patternSource
        })

        const result = yield* completeBatchTransformInput(partial, appConfig.patternSource)

        expect(result.transformations).toHaveLength(2)
        expect(result.transformations[0].stop).toBe(500)
        expect(result.transformations[1].stop).toBe(600)
        expect("target" in result.transformations[0]).toBe(true)
        expect("targets" in result.transformations[1]).toBe(true)
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

    it.effect("should prompt for all missing fields", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial: BatchTransformPartial = {
          transformations: [
            { reference: "#2D72D2", target: "#238551" }
          ]
        }

        const result = yield* completeBatchTransformInput(partial, appConfig.patternSource)

        expect(result.transformations[0].stop).toBe(500)
        expect(result.format).toBe("rgb")
        expect(result.name).toBe("batch-test")
      }).pipe(
        Effect.provide(
          Layer.merge(
            MainTest,
            PromptService.makeTest({
              textResponses: ["batch-test"],
              selectResponses: [500, "rgb"],
              confirmResponses: []
            })
          )
        )
      ))

    it.effect("should fail when select responses exhausted", () =>
      Effect.gen(function*() {
        const config = yield* ConfigService
        const appConfig = yield* config.getConfig()

        const partial = yield* decodeBatchTransformPartial({
          transformations: [
            { reference: "#2D72D2", target: "#238551" },
            { reference: "#BD5200", target: "#DB2C6F" }
          ],
          format: "hex",
          name: "test",
          pattern: appConfig.patternSource
        })

        const error = yield* Effect.flip(completeBatchTransformInput(partial, appConfig.patternSource))

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

  describe("buildSingleTransformPartial", () => {
    it("should build partial with all options", () => {
      const result = buildSingleTransformPartial({
        reference: "#2D72D2",
        target: "#238551",
        stopOpt: O.some(500),
        formatOpt: O.some("hex"),
        nameOpt: O.some("test"),
        patternOpt: O.some("/path")
      })

      expect(result.reference).toBe("#2D72D2")
      expect(result.target).toBe("#238551")
      expect(result.stop).toBe(500)
      expect(result.format).toBe("hex")
    })

    it("should refine invalid stop to undefined", () => {
      const result = buildSingleTransformPartial({
        reference: "#2D72D2",
        target: "#238551",
        stopOpt: O.some(999),
        formatOpt: O.some("hex"),
        nameOpt: O.none(),
        patternOpt: O.none()
      })

      expect(result.stop).toBeUndefined()
    })
  })

  describe("buildManyTransformPartial", () => {
    it("should build partial with all options", () => {
      const result = buildManyTransformPartial({
        reference: "#BD5200",
        targets: ["#2D72D2", "#238551"],
        stopOpt: O.some(600),
        formatOpt: O.some("oklch"),
        nameOpt: O.some("many"),
        patternOpt: O.none()
      })

      expect(result.reference).toBe("#BD5200")
      expect(result.targets).toEqual(["#2D72D2", "#238551"])
      expect(result.stop).toBe(600)
      expect(result.format).toBe("oklch")
    })
  })

  describe("buildBatchTransformPartial", () => {
    it("should build partial with transformations", () => {
      const result = buildBatchTransformPartial({
        transformations: [
          { reference: "#2D72D2", target: "#238551", stop: 500 }
        ],
        formatOpt: O.some("hex"),
        nameOpt: O.some("batch"),
        patternOpt: O.none()
      })

      expect(result.transformations).toHaveLength(1)
      expect(result.format).toBe("hex")
      expect(result.name).toBe("batch")
    })
  })
})
