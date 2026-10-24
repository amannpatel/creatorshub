// Local development database (no Atlas account needed). Runs a real MongoDB binary on
// mongodb://127.0.0.1:27017 with data persisted in ./.data/db. Not for production.
//
// Usage: npm run db:local   (keep it running in its own terminal)
import { mkdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = new URL("../.data/db", import.meta.url);
mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: {
    port: 27017,
    ip: "127.0.0.1",
    dbPath: decodeURIComponent(dbPath.pathname.replace(/^\/([A-Za-z]:)/, "$1")),
    storageEngine: "wiredTiger",
  },
});

console.log(`Local MongoDB running at ${server.getUri()}creatorshub`);
console.log("Data is stored in .data/db — press Ctrl+C to stop.");

async function shutdown() {
  await server.stop({ doCleanup: false, force: false });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
