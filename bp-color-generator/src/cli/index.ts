import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { generate } from "./commands/generate.js"

const runCli = Command.run(generate, {
  name: "BP Color Generator",
  version: "0.1.0"
})

const MainLive = NodeContext.layer

const main = runCli(process.argv).pipe(
  Effect.provide(MainLive)
)

NodeRuntime.runMain(main)
