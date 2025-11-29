/**
 * Unit tests for ModeResolver service
 */

import { Effect, Either, Option as O } from "effect"
import { describe, expect, it } from "vitest"
import { ModeResolver } from "../../../src/cli/commands/generate/modes/resolver.js"
import { MainTest } from "../../../src/layers/MainTest.js"

describe("ModeResolver Service", () => {
  describe("Single Palette Mode Detection", () => {
    it("should detect single palette mode with color and stop", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("#2D72D2"),
          stopOpt: O.some(500),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("SinglePalette")

        if (result.mode._tag === "SinglePalette") {
          expect(result.mode.color).toBe("#2D72D2")
          expect(result.mode.stop).toBe(500)
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect single palette mode with color only", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("#2D72D2"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("SinglePalette")

        if (result.mode._tag === "SinglePalette") {
          expect(result.mode.color).toBe("#2D72D2")
          expect(result.mode.stop).toBeUndefined()
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect interactive mode when no color provided", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.none(),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(true)
        expect(result.mode._tag).toBe("SinglePalette")
      }).pipe(Effect.provide(MainTest), Effect.runPromise))
  })

  describe("Batch Palette Mode Detection", () => {
    it("should detect batch mode from comma-separated colors", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("#2D72D2,#DB2C6F"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("BatchPalettes")

        if (result.mode._tag === "BatchPalettes") {
          expect(result.mode.pairs).toHaveLength(2)
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect batch mode from color::stop pairs", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("#2D72D2::500,#DB2C6F::600"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("BatchPalettes")

        if (result.mode._tag === "BatchPalettes") {
          expect(result.mode.pairs).toHaveLength(2)
          expect(result.mode.pairs[0].stop).toBe(500)
          expect(result.mode.pairs[1].stop).toBe(600)
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect batch mode from single color with :: separator", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("#2D72D2::500"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("BatchPalettes")

        if (result.mode._tag === "BatchPalettes") {
          expect(result.mode.pairs).toHaveLength(1)
          expect(result.mode.pairs[0].color).toBe("#2D72D2")
          expect(result.mode.pairs[0].stop).toBe(500)
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))
  })

  describe("Single Transformation Mode Detection", () => {
    it("should detect single transformation mode with stop", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("2D72D2>238551::500"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("SingleTransform")

        if (result.mode._tag === "SingleTransform") {
          expect(result.mode.input.reference).toContain("2D72D2")
          expect(result.mode.input.target).toContain("238551")
          expect(result.mode.input.stop).toBe(500)
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect single transformation mode without stop (partial)", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("555555>666666"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("SingleTransform")

        if (result.mode._tag === "SingleTransform") {
          expect(result.mode.input.reference).toContain("555555")
          expect(result.mode.input.target).toContain("666666")
          expect(result.mode.input.stop).toBeUndefined()
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should handle transformation with # prefix", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("#2D72D2>#238551::500"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("SingleTransform")
      }).pipe(Effect.provide(MainTest), Effect.runPromise))
  })

  describe("Many Transformation Mode Detection", () => {
    it("should detect one-to-many transformation mode with stop", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("2D72D2>(238551,DC143C)::500"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("ManyTransform")

        if (result.mode._tag === "ManyTransform") {
          expect(result.mode.reference).toContain("2D72D2")
          expect(result.mode.targets).toHaveLength(2)
          expect(result.mode.targets[0]).toContain("238551")
          expect(result.mode.targets[1]).toContain("DC143C")
          expect(result.mode.stop).toBe(500)
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect one-to-many transformation mode without stop (partial)", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("BD5200>(2D72D2, #238551, BD5200, #CD4246)"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("ManyTransform")

        if (result.mode._tag === "ManyTransform") {
          expect(result.mode.reference).toContain("BD5200")
          expect(result.mode.targets).toHaveLength(4)
          expect(result.mode.targets[0]).toContain("2D72D2")
          expect(result.mode.targets[1]).toContain("238551")
          expect(result.mode.targets[2]).toContain("BD5200")
          expect(result.mode.targets[3]).toContain("CD4246")
          expect(result.mode.stop).toBeUndefined()
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))
  })

  describe("Batch Transformation Mode Detection", () => {
    it("should detect batch transformation mode from comma-separated with stops", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("2D72D2>238551::500,DB2C6F>FF6B9D::600"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("BatchTransform")

        if (result.mode._tag === "BatchTransform") {
          expect(result.mode.transformations).toHaveLength(2)
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect batch transformation mode without stops (partial)", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("555555>666666, 777777>888888"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("BatchTransform")

        if (result.mode._tag === "BatchTransform") {
          expect(result.mode.transformations).toHaveLength(2)
          expect(result.mode.transformations[0].stop).toBeUndefined()
          expect(result.mode.transformations[1].stop).toBeUndefined()
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect batch transformation mode with mixed single and one-to-many", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("BD5200>(2D72D2,#238551,BD5200,#CD4246),555555>666666"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("BatchTransform")

        if (result.mode._tag === "BatchTransform") {
          expect(result.mode.transformations).toHaveLength(2)

          // First should be one-to-many
          const first = result.mode.transformations[0]
          if ("targets" in first && first.targets) {
            expect(first.reference).toContain("BD5200")
            expect(first.targets).toHaveLength(4)
            expect(first.stop).toBeUndefined()
          } else {
            throw new Error("First transformation should be one-to-many with targets property")
          }

          // Second should be single
          const second = result.mode.transformations[1]
          if ("target" in second && second.target && !("targets" in second)) {
            expect(second.reference).toContain("555555")
            expect(second.target).toContain("666666")
            expect(second.stop).toBeUndefined()
          } else {
            throw new Error("Second transformation should be single with target property")
          }
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should detect batch transformation mode from newline-separated", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* resolver.detectMode({
          colorOpt: O.some("2D72D2>238551::500\nDB2C6F>FF6B9D::600"),
          stopOpt: O.none(),
          formatOpt: O.none(),
          nameOpt: O.none(),
          patternOpt: O.none(),
          exportOpt: O.none(),
          exportPath: O.none()
        })

        expect(result.isInteractive).toBe(false)
        expect(result.mode._tag).toBe("BatchTransform")

        if (result.mode._tag === "BatchTransform") {
          expect(result.mode.transformations).toHaveLength(2)
        }
      }).pipe(Effect.provide(MainTest), Effect.runPromise))
  })

  describe("Error Handling", () => {
    it("should fail with invalid color", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* Effect.either(
          resolver.detectMode({
            colorOpt: O.some("invalid-color"),
            stopOpt: O.some(500),
            formatOpt: O.none(),
            nameOpt: O.none(),
            patternOpt: O.none(),
            exportOpt: O.none(),
            exportPath: O.none()
          })
        )

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(MainTest), Effect.runPromise))

    it("should fail with invalid stop position", () =>
      Effect.gen(function*() {
        const resolver = yield* ModeResolver
        const result = yield* Effect.either(
          resolver.detectMode({
            colorOpt: O.some("#2D72D2"),
            stopOpt: O.some(999), // Invalid stop
            formatOpt: O.none(),
            nameOpt: O.none(),
            patternOpt: O.none(),
            exportOpt: O.none(),
            exportPath: O.none()
          })
        )

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(MainTest), Effect.runPromise))
  })
})
