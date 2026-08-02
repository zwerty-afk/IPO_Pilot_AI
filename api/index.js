/**
 * Vercel serverless entrypoint.
 *
 * Vercel auto-detects functions in this directory, so the Express app lives here
 * as a re-export rather than being wired up in vercel.json. server.js checks
 * process.env.VERCEL and exports a request handler instead of calling listen().
 *
 * The rewrite in vercel.json sends every /api/* path here, and Express matches on
 * the original URL (which still carries the /api prefix its routes expect).
 */
export { default } from '../server/server.js';
