/**
 * Tests for ConsoleService
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { MainTest } from "../../../src/layers/MainTest.js"
import { ConsoleService } from "../../../src/services/ConsoleService/index.js"

describe("ConsoleService", () => {
  describe("Test layer", () => {
    describe("intro", () => {
      it.effect("should capture intro messages", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.intro("Welcome!")
          yield* console.intro("Second intro")

          const captured = yield* console.getCaptured()
          expect(captured.intros).toEqual(["Welcome!", "Second intro"])
        }).pipe(Effect.provide(MainTest)))
    })

    describe("outro", () => {
      it.effect("should capture outro messages", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.outro("Goodbye!")
          yield* console.outro("Final message")

          const captured = yield* console.getCaptured()
          expect(captured.outros).toEqual(["Goodbye!", "Final message"])
        }).pipe(Effect.provide(MainTest)))
    })

    describe("cancel", () => {
      it.effect("should capture cancel messages", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.cancel("Operation cancelled")

          const captured = yield* console.getCaptured()
          expect(captured.cancels).toEqual(["Operation cancelled"])
        }).pipe(Effect.provide(MainTest)))
    })

    describe("note", () => {
      it.effect("should capture notes with title", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.note("Note content", "Note Title")

          const captured = yield* console.getCaptured()
          expect(captured.notes).toEqual([
            { content: "Note content", title: "Note Title" }
          ])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture notes without title", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.note("Content only")

          const captured = yield* console.getCaptured()
          expect(captured.notes).toEqual([
            { content: "Content only", title: undefined }
          ])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture multiple notes", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.note("First note", "Title 1")
          yield* console.note("Second note")
          yield* console.note("Third note", "Title 3")

          const captured = yield* console.getCaptured()
          expect(captured.notes).toHaveLength(3)
          expect(captured.notes[0]).toEqual({
            content: "First note",
            title: "Title 1"
          })
          expect(captured.notes[1]).toEqual({
            content: "Second note",
            title: undefined
          })
          expect(captured.notes[2]).toEqual({
            content: "Third note",
            title: "Title 3"
          })
        }).pipe(Effect.provide(MainTest)))
    })

    describe("log", () => {
      it.effect("should capture success logs", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.log.success("Operation succeeded")
          yield* console.log.success("Another success")

          const captured = yield* console.getCaptured()
          expect(captured.logs.success).toEqual([
            "Operation succeeded",
            "Another success"
          ])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture error logs", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.log.error("Something went wrong")

          const captured = yield* console.getCaptured()
          expect(captured.logs.error).toEqual(["Something went wrong"])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture warning logs", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.log.warning("Be careful")

          const captured = yield* console.getCaptured()
          expect(captured.logs.warning).toEqual(["Be careful"])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture info logs", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.log.info("FYI")

          const captured = yield* console.getCaptured()
          expect(captured.logs.info).toEqual(["FYI"])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture message logs", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.log.message("Just a message")

          const captured = yield* console.getCaptured()
          expect(captured.logs.message).toEqual(["Just a message"])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture step logs", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.log.step("Step 1")
          yield* console.log.step("Step 2")

          const captured = yield* console.getCaptured()
          expect(captured.logs.step).toEqual(["Step 1", "Step 2"])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture all log types independently", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          yield* console.log.success("success msg")
          yield* console.log.error("error msg")
          yield* console.log.warning("warning msg")
          yield* console.log.info("info msg")
          yield* console.log.message("message msg")
          yield* console.log.step("step msg")

          const captured = yield* console.getCaptured()
          expect(captured.logs.success).toEqual(["success msg"])
          expect(captured.logs.error).toEqual(["error msg"])
          expect(captured.logs.warning).toEqual(["warning msg"])
          expect(captured.logs.info).toEqual(["info msg"])
          expect(captured.logs.message).toEqual(["message msg"])
          expect(captured.logs.step).toEqual(["step msg"])
        }).pipe(Effect.provide(MainTest)))
    })

    describe("spinner", () => {
      it.effect("should capture spinner start messages", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          const spinner = yield* console.spinner()
          yield* spinner.start("Loading...")

          const captured = yield* console.getCaptured()
          expect(captured.spinnerMessages).toEqual(["start: Loading..."])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture spinner stop messages", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          const spinner = yield* console.spinner()
          yield* spinner.start("Working")
          yield* spinner.stop("Done!")

          const captured = yield* console.getCaptured()
          expect(captured.spinnerMessages).toEqual([
            "start: Working",
            "stop: Done!"
          ])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should capture spinner message updates", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          const spinner = yield* console.spinner()
          yield* spinner.start("Starting")
          yield* spinner.message("Processing item 1")
          yield* spinner.message("Processing item 2")
          yield* spinner.stop("Complete")

          const captured = yield* console.getCaptured()
          expect(captured.spinnerMessages).toEqual([
            "start: Starting",
            "Processing item 1",
            "Processing item 2",
            "stop: Complete"
          ])
        }).pipe(Effect.provide(MainTest)))
    })

    describe("getCaptured", () => {
      it.effect("should return empty state initially", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService
          const captured = yield* console.getCaptured()

          expect(captured.intros).toEqual([])
          expect(captured.outros).toEqual([])
          expect(captured.cancels).toEqual([])
          expect(captured.notes).toEqual([])
          expect(captured.logs.success).toEqual([])
          expect(captured.logs.error).toEqual([])
          expect(captured.logs.warning).toEqual([])
          expect(captured.logs.info).toEqual([])
          expect(captured.logs.message).toEqual([])
          expect(captured.logs.step).toEqual([])
          expect(captured.spinnerMessages).toEqual([])
        }).pipe(Effect.provide(MainTest)))

      it.effect("should accumulate all output types", () =>
        Effect.gen(function*() {
          const console = yield* ConsoleService

          yield* console.intro("Intro")
          yield* console.log.success("Success")
          yield* console.note("Note", "Title")
          yield* console.outro("Outro")

          const captured = yield* console.getCaptured()
          expect(captured.intros).toEqual(["Intro"])
          expect(captured.logs.success).toEqual(["Success"])
          expect(captured.notes).toEqual([{ content: "Note", title: "Title" }])
          expect(captured.outros).toEqual(["Outro"])
        }).pipe(Effect.provide(MainTest)))
    })
  })

  describe("Default layer", () => {
    it.effect("should return empty captured output", () =>
      Effect.gen(function*() {
        const console = yield* ConsoleService
        const captured = yield* console.getCaptured()

        // Default implementation returns initial empty state for getCaptured
        expect(captured.intros).toEqual([])
        expect(captured.outros).toEqual([])
        expect(captured.cancels).toEqual([])
        expect(captured.notes).toEqual([])
        expect(captured.spinnerMessages).toEqual([])
      }).pipe(Effect.provide(ConsoleService.Default)))
  })
})
