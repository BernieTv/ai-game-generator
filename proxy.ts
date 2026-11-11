import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

// Everything under /studio and the preview API belongs to a signed-in member of
// an organization. The landing page and the auth pages stay public.
const isProtected = createRouteMatcher(["/studio(.*)", "/api/games(.*)"])

export default clerkMiddleware(async (auth, request) => {
  if (isProtected(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next internals, the Sentry tunnel and static files.
    "/((?!monitoring|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
