import { database } from "../src/repositories/database.js";

const status = await database.checkConnection();
console.log(`Database: ${status}`);
await database.disconnect();
if (status !== "up") process.exitCode = 1;
