/**
 * server.cjs - CommonJS entry point for Hostinger (LiteSpeed Node.js loader / lsnode.js).
 * 
 * Hostinger's Node.js loader requires the startup file synchronously using CommonJS require().
 * When server.mjs uses ES modules and top-level await (for database initialization and Vite loading),
 * direct require() throws ERR_REQUIRE_ASYNC_MODULE.
 * 
 * This wrapper is fully CommonJS-compatible and safely bootstraps the ES module backend
 * via dynamic import(), capturing any startup errors and logging them clearly.
 */

// Capture any unhandled async promise rejections during bootstrap
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Hostinger Startup Error] Unhandled promise rejection:', reason);
});

(async () => {
  try {
    // Dynamic import works with ESM graphs containing top-level await
    await import('./server.mjs');
  } catch (err) {
    console.error('[Hostinger Startup Error] Fatal failure during server startup:');
    console.error(err);
    process.exit(1);
  }
})();
