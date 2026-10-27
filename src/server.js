import dotenv from "dotenv";

import app from "./app.js";
import pool from "./config/database.js";

dotenv.config();

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`Transaction Ledger API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} recieved. Shutting down...`);

  server.close(async () => {
    try {
      await pool.end();
      console.log("PostgreSQL pool Closed.");
      process.exit(0);
    } catch (error) {
      console.error("Error closing PostgreSQL pool:", error);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
