/**
 * server.js - Startup entry wrapper.
 * 
 * Hostinger's lsnode.js loader uses require() on the configured entry file.
 * To prevent ERR_REQUIRE_ASYNC_MODULE when the server graph uses top-level await,
 * this file delegates directly to server.mjs via dynamic import().
 */
import('./server.mjs').catch((err) => {
  console.error('[Hostinger Startup Error] Fatal failure during server startup:');
  console.error(err);
  process.exit(1);
});
