/**
 * Tests for PromptService
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"
import { MainTest } from "../../../src/layers/MainTest.js"
import { CancelledError, PromptService } from "../../../src/services/PromptService/index.js"

describe("PromptService", () => {
  describe("Test layer with makeTest", () => {
    describe("text", () => {
      it.effect("should return scripted text responses in order", () =>
        Effect.gen(function*() {
          const prompt = yield* PromptService

          const first = yield* prompt.text({ message: "First question?" })
          const second = yield* prompt.text({ message: "Second question?" })
          const third = yield* prompt.text({ message: "Third question?" })

          expect(first).toBe("response-1")
          expect(second).toBe("response-2")
          expect(third).toBe("response-3")
        }).pipe(
          Effect.provide(
            PromptService.makeTest({
              textResponses: ["response-1", "response-2", "response-3"],
              selectResponses: [],
              confirmResponses: []
            })
          )
        ))

      it.effect(
        "should fail with CancelledError when no more text responses",
        () =>
          Effect.gen(function*() {
            const prompt = yield* PromptService

            // Use the only response
            yield* prompt.text({ message: "First?" })

            // Try to get another response
            const result = yield* Effect.either(
              prompt.text({ message: "Second?" })
            )

            expect(Either.isLeft(result)).toBe(true)
            if (Either.isLeft(result)) {
              expect(result.left).toBeInstanceOf(CancelledError)
              expect(result.left.message).toBe(
                "No more scripted text responses"
              )
            }
          }).pipe(
            Effect.provide(
              PromptService.makeTest({
                textResponses: ["only-one"],
                selectResponses: [],
                confirmResponses: []
              })
            )
          )
      )

      it.effect("should ignore prompt options in test mode", () =>
        Effect.gen(function*() {
          const prompt = yield* PromptService

          const response = yield* prompt.text({
            message: "Enter value",
            placeholder: "ignored",
            defaultValue: "also ignored",
            validate: () => "validation ignored"
          })

          expect(response).toBe("test-value")
        }).pipe(
          Effect.provide(
            PromptService.makeTest({
              textResponses: ["test-value"],
              selectResponses: [],
              confirmResponses: []
            })
          )
        ))
    })

    describe("select", () => {
      it.effect("should return scripted select responses in order", () =>
        Effect.gen(function*() {
          const prompt = yield* PromptService

          const first = yield* prompt.select({
            message: "Choose:",
            options: [
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" }
            ]
          })

          const second = yield* prompt.select({
            message: "Choose again:",
            options: [
              { value: 1, label: "One" },
              { value: 2, label: "Two" }
            ]
          })

          expect(first).toBe("selected-a")
          expect(second).toBe("selected-b")
        }).pipe(
          Effect.provide(
            PromptService.makeTest({
              textResponses: [],
              selectResponses: ["selected-a", "selected-b"],
              confirmResponses: []
            })
          )
        ))

      it.effect(
        "should fail with CancelledError when no more select responses",
        () =>
          Effect.gen(function*() {
            const prompt = yield* PromptService

            const result = yield* Effect.either(
              prompt.select({
                message: "Choose:",
                options: [{ value: "a", label: "A" }]
              })
            )

            expect(Either.isLeft(result)).toBe(true)
            if (Either.isLeft(result)) {
              expect(result.left).toBeInstanceOf(CancelledError)
              expect(result.left.message).toBe(
                "No more scripted select responses"
              )
            }
          }).pipe(
            Effect.provide(
              PromptService.makeTest({
                textResponses: [],
                selectResponses: [],
                confirmResponses: []
              })
            )
          )
      )

      it.effect("should support typed select responses", () =>
        Effect.gen(function*() {
          const prompt = yield* PromptService

          type ColorOption = "red" | "green" | "blue"
          const color = yield* prompt.select<ColorOption>({
            message: "Pick a color:",
            options: [
              { value: "red", label: "Red" },
              { value: "green", label: "Green" },
              { value: "blue", label: "Blue" }
            ]
          })

          expect(color).toBe("blue")
        }).pipe(
          Effect.provide(
            PromptService.makeTest<"red" | "green" | "blue">({
              textResponses: [],
              selectResponses: ["blue"],
              confirmResponses: []
            })
          )
        ))
    })

    describe("confirm", () => {
      it.effect("should return scripted confirm responses in order", () =>
        Effect.gen(function*() {
          const prompt = yield* PromptService

          const first = yield* prompt.confirm({ message: "Continue?" })
          const second = yield* prompt.confirm({ message: "Are you sure?" })
          const third = yield* prompt.confirm({ message: "Really?" })

          expect(first).toBe(true)
          expect(second).toBe(false)
          expect(third).toBe(true)
        }).pipe(
          Effect.provide(
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [],
              confirmResponses: [true, false, true]
            })
          )
        ))

      it.effect(
        "should fail with CancelledError when no more confirm responses",
        () =>
          Effect.gen(function*() {
            const prompt = yield* PromptService

            const result = yield* Effect.either(
              prompt.confirm({ message: "Continue?" })
            )

            expect(Either.isLeft(result)).toBe(true)
            if (Either.isLeft(result)) {
              expect(result.left).toBeInstanceOf(CancelledError)
              expect(result.left.message).toBe(
                "No more scripted confirm responses"
              )
            }
          }).pipe(
            Effect.provide(
              PromptService.makeTest({
                textResponses: [],
                selectResponses: [],
                confirmResponses: []
              })
            )
          )
      )

      it.effect("should ignore initialValue in test mode", () =>
        Effect.gen(function*() {
          const prompt = yield* PromptService

          const response = yield* prompt.confirm({
            message: "Accept?",
            initialValue: true // This would be the default in real usage
          })

          expect(response).toBe(false) // Scripted response overrides
        }).pipe(
          Effect.provide(
            PromptService.makeTest({
              textResponses: [],
              selectResponses: [],
              confirmResponses: [false]
            })
          )
        ))
    })

    describe("mixed prompts", () => {
      it.effect("should handle mixed prompt types independently", () =>
        Effect.gen(function*() {
          const prompt = yield* PromptService

          const name = yield* prompt.text({ message: "Name?" })
          const choice = yield* prompt.select({
            message: "Pick:",
            options: [{ value: "x", label: "X" }]
          })
          const confirmed = yield* prompt.confirm({ message: "OK?" })
          const email = yield* prompt.text({ message: "Email?" })

          expect(name).toBe("John")
          expect(choice).toBe("option-a")
          expect(confirmed).toBe(true)
          expect(email).toBe("john@example.com")
        }).pipe(
          Effect.provide(
            PromptService.makeTest({
              textResponses: ["John", "john@example.com"],
              selectResponses: ["option-a"],
              confirmResponses: [true]
            })
          )
        ))
    })
  })

  describe("Default Test layer", () => {
    it.effect("should fail immediately on text prompt", () =>
      Effect.gen(function*() {
        const prompt = yield* PromptService
        const result = yield* Effect.either(
          prompt.text({ message: "Question?" })
        )

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(CancelledError)
        }
      }).pipe(Effect.provide(MainTest)))

    it.effect("should fail immediately on select prompt", () =>
      Effect.gen(function*() {
        const prompt = yield* PromptService
        const result = yield* Effect.either(
          prompt.select({
            message: "Choose:",
            options: [{ value: "a", label: "A" }]
          })
        )

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(CancelledError)
        }
      }).pipe(Effect.provide(MainTest)))

    it.effect("should fail immediately on confirm prompt", () =>
      Effect.gen(function*() {
        const prompt = yield* PromptService
        const result = yield* Effect.either(
          prompt.confirm({ message: "Sure?" })
        )

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(CancelledError)
        }
      }).pipe(Effect.provide(MainTest)))
  })

  describe("CancelledError", () => {
    it("should have correct tag", () => {
      const error = new CancelledError({ message: "Test cancellation" })
      expect(error._tag).toBe("CancelledError")
    })

    it("should preserve message", () => {
      const error = new CancelledError({ message: "User pressed Ctrl+C" })
      expect(error.message).toBe("User pressed Ctrl+C")
    })
  })
})
