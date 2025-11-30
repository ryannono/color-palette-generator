/**
 * Test layer composition
 *
 * Mirrors MainLive but uses test implementations for all services.
 */

import { NodeContext } from "@effect/platform-node"
import { Layer } from "effect"
import { ModeResolver } from "../cli/commands/generate/modes/resolver.js"
import { WorkflowCoordinator } from "../cli/commands/generate/workflows/WorkflowCoordinator.js"
import { ConfigService } from "../services/ConfigService.js"
import { ConsoleService } from "../services/ConsoleService/index.js"
import { PromptService } from "../services/PromptService/index.js"

/**
 * Main test layer with all services
 *
 * Use this as the single source of truth for test dependencies.
 *
 * Layer types:
 * - `.Test` layers: Mock implementations that capture output, provide
 *   scripted responses, or use test-specific config values
 *   (ConsoleService, PromptService, ConfigService)
 * - `.Test` layers (pure): Same implementation as Default since the service
 *   is pure/deterministic with no side effects to mock
 *   (ModeResolver - just parses input syntax)
 *
 * Note: Pattern loading, palette generation, and exporting now use
 * use case functions with I/O capabilities passed as arguments
 * (see src/usecases/ and src/io/).
 * Tests use makeFilePatternLoader/makeFileExporter with real file fixtures.
 */
export const MainTest = Layer.mergeAll(
  // Test implementations (mocked/scripted)
  ConfigService.Test,
  ConsoleService.Test,
  ModeResolver.Test,
  PromptService.Test,
  // Pure services
  WorkflowCoordinator.Default,
  // Platform dependencies for file I/O
  NodeContext.layer
)
