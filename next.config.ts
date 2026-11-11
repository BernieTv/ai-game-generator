import { withSentryConfig } from "@sentry/nextjs/config"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
}

// Sentry is optional: without SENTRY_DSN the SDK stays disabled, and without
// SENTRY_AUTH_TOKEN source maps are simply not uploaded.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Routes browser events through the app to avoid ad-blockers.
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  silent: !process.env.CI,
  release: { name: process.env.SENTRY_RELEASE ?? process.env.RAILWAY_GIT_COMMIT_SHA },
})
