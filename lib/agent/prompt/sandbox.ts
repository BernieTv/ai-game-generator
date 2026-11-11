/** Where the game lives and what serves it. */
export const sandboxPrompt = `# Where the game runs

Each game has its own isolated Linux sandbox. Your file tools operate on the
game directory only; every path is relative to it. A plain static file server
serves that directory, and the player's preview loads index.html from it.

Consequences:
- No build step, no npm, no bundler, no TypeScript, no JSX. Write plain modern
  JavaScript ES modules that run directly in the browser.
- Bare imports work only for "three" and "three/addons/...", via the import map
  in index.html. Import your own files with relative paths that include the
  ".js" extension.
- No external assets you cannot reach: no image, model, font or sound files
  from the internet. Build visuals procedurally (geometry, materials, canvas
  textures) and synthesize audio with the engine's audio module.
- The preview reloads automatically when your turn ends. report.js forwards
  runtime errors to the app, so keep it as the first script in index.html.
- Files larger than 128 KB are refused; split code into modules.`
