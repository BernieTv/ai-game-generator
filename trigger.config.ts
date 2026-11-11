import { createRequire } from "node:module"
import { join } from "node:path"

import type { BuildExtension } from "@trigger.dev/build/extensions"
import { additionalFiles } from "@trigger.dev/build/extensions/core"
import { defineConfig } from "@trigger.dev/sdk"

/**
 * Keeps `@daytona/sdk` out of the deploy bundle and installs it as a real
 * dependency instead.
 *
 * The SDK loads some of its dependencies (form-data, tar, fast-glob) through a
 * dynamic `require` that esbuild cannot follow, so a bundled copy fails at the
 * first file upload with "Cannot find module". `build.external` does not catch
 * this package's CJS entry, hence a small resolver plugin plus a dependency
 * layer pinned to the installed version.
 */
const daytonaAsDependency: BuildExtension = {
  name: "daytona-as-dependency",
  onBuildStart(context) {
    if (context.target !== "deploy") return

    context.registerPlugin(
      {
        name: "daytona-external",
        setup(build) {
          build.onResolve({ filter: /^@daytona\/sdk(\/.*)?$/ }, (args) => ({
            path: args.path,
            external: true,
          }))
        },
      },
      { placement: "first", target: "deploy" }
    )

    const require = createRequire(join(context.workingDir, "package.json"))
    const { version } = require("@daytona/sdk/package.json") as { version: string }

    context.addLayer({
      id: "daytona-as-dependency",
      dependencies: { "@daytona/sdk": version },
    })
  },
}

export default defineConfig({
  // Your project ref from the Trigger.dev dashboard (Project settings).
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_replace_with_your_project_ref",
  runtime: "node-22",
  logLevel: "log",
  // A long build can take several minutes; a waiting chat suspends and does
  // not count towards this.
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 10_000, factor: 2 },
  },
  dirs: ["trigger"],
  build: {
    extensions: [
      daytonaAsDependency,
      // The sandbox seed files are read from disk at runtime, never imported,
      // so they must be copied into the deployment explicitly.
      additionalFiles({ files: ["game-runtime/**/*"] }),
    ],
  },
})
