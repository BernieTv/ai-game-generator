/*
 * report.js — Playforge error reporter. MUST be the first <script> in index.html.
 *
 * Collects uncaught errors, failed <script>/<link> loads, unhandled promise
 * rejections and console.error calls, and reports them to the parent page
 * (the Playforge preview) via postMessage:
 *   -> { type: "playforge:error", error: { message, source, line, column, stack } }   for each new error
 *   <- { type: "playforge:ping" }
 *   -> { type: "playforge:status", errors: [...], ready: boolean }                   reply to a ping
 * `ready` becomes true when the engine sets window.__playforgeReady after the first frame.
 * Plain ES5 classic script: no modules, no dependencies.
 */
(function () {
  "use strict";
  if (window.__playforgeReporter) return;
  window.__playforgeReporter = true;

  var MAX_ERRORS = 10;
  var MAX_LEN = 2000;
  var errors = [];
  var seen = {};
  var hasParent = false;
  try {
    hasParent = window.parent && window.parent !== window;
  } catch (e) {
    hasParent = false;
  }

  function truncate(value) {
    var s = value == null ? "" : String(value);
    return s.length > MAX_LEN ? s.slice(0, MAX_LEN) + "…" : s;
  }

  function post(target, data) {
    if (!target || target === window) return;
    try {
      target.postMessage(data, "*");
    } catch (e) {
      /* parent gone or not cloneable */
    }
  }

  function record(message, source, line, column, stack) {
    var error = {
      message: truncate(message || "Unknown error"),
      source: truncate(source || ""),
      line: typeof line === "number" ? line : null,
      column: typeof column === "number" ? column : null,
      stack: truncate(stack || "")
    };
    var key = error.message + "|" + error.source + "|" + error.line + "|" + error.column;
    if (seen[key] || errors.length >= MAX_ERRORS) return;
    seen[key] = true;
    errors.push(error);
    if (hasParent) post(window.parent, { type: "playforge:error", error: error });
  }

  function describe(value) {
    if (value instanceof Error) return value.name + ": " + value.message;
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  // Runtime errors (ErrorEvent) and resource load failures (capture phase: they don't bubble).
  window.addEventListener(
    "error",
    function (event) {
      var target = event.target;
      if (target && target !== window && target.tagName) {
        var tag = target.tagName.toLowerCase();
        if (tag === "script" || tag === "link" || tag === "img" || tag === "audio" || tag === "video") {
          var url = target.src || target.href || "";
          var label = tag === "script" ? "script" : tag === "link" ? "stylesheet" : tag;
          record("Failed to load " + label + ": " + url, url, null, null, "");
        }
        return;
      }
      var err = event.error;
      record(
        event.message || (err && err.message) || "Script error",
        event.filename || "",
        event.lineno,
        event.colno,
        err && err.stack ? err.stack : ""
      );
    },
    true
  );

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    var message = "Unhandled promise rejection: " + describe(reason);
    record(message, "", null, null, reason && reason.stack ? reason.stack : "");
  });

  if (window.console && typeof window.console.error === "function") {
    var originalError = window.console.error;
    window.console.error = function () {
      try {
        var parts = [];
        var stack = "";
        for (var i = 0; i < arguments.length; i++) {
          parts.push(describe(arguments[i]));
          if (!stack && arguments[i] instanceof Error && arguments[i].stack) stack = arguments[i].stack;
        }
        record("console.error: " + parts.join(" "), "", null, null, stack);
      } catch (e) {
        /* never break logging */
      }
      return originalError.apply(this, arguments);
    };
  }

  function status() {
    return { type: "playforge:status", errors: errors.slice(), ready: window.__playforgeReady === true };
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "playforge:ping") return;
    post(event.source || (hasParent ? window.parent : null), status());
  });

  // Proactively tell the parent once the first frame has rendered.
  window.addEventListener("playforge:ready", function () {
    if (hasParent) post(window.parent, status());
  });

  window.__playforgeErrors = errors;
})();
