/**
 * Main application layer composition
 *
 * Composes all services with their production dependencies.
 * Each service gets its dependencies provided, then all are merged.
 */

import { NodeContext } from "@effect/platform-node"
import { Layer } from "effect"
import { ModeResolver } from "../cli/commands/generate/modes/resolver.js"
import { ConfigService } from "../services/ConfigService.js"
import { ConsoleService } from "../services/ConsoleService/index.js"
import { ExportService } from "../services/ExportService/index.js"
import { PaletteService } from "../services/PaletteService/index.js"
import { PatternService } from "../services/PatternService/index.js"
import { PromptService } from "../services/PromptService/index.js"

/**
 * Main production layer with all services and platform dependencies
 *
 * Dependency graph (automatically resolved by Effect):
 *
 *   NodeContext (FileSystem, Path)
 *        │
 *        ├──► PatternService (file I/O for patterns)
 *        │         │
 *        │         └──────────┐
 *        │                    │
 *        └──► ExportService   │
 *                             │
 *   ConfigService ────────────┼──► PaletteService
 *   (no deps)                 │
 *                             │
 *                    (Pattern + Config)
 *
 *   ConsoleService (CLI output)
 *   PromptService (CLI input)
 *   ModeResolver (CLI mode detection, no deps)
 */
export const MainLive = Layer.mergeAll(
  ConfigService.Default,
  ConsoleService.Default,
  ExportService.Default,
  ModeResolver.Default,
  PaletteService.Default,
  PatternService.Default,
  PromptService.Default,
  NodeContext.layer
)
