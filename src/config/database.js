import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const debugSql = process.env.DEBUG_SQL === "true";

function logQueryStart(query) {
  if (!debugSql) {
    return null;
  }

  const sql = typeof query === "string" ? query : query.text;

  console.log(`[SQL] ${sql}`);

  return Date.now();
}

function logQueryEnd(startTime, error) {
  if (startTime === null) {
    return;
  }

  const durationMs = Date.now() - startTime;

  if (error) {
    console.error(
      `[SQL ERROR] code=${error.code || "UNKNOWN"} duration=${durationMs}ms`,
    );
    return;
  }

  console.log(`[SQL OK] duration=${durationMs}ms`);
}

async function query(text, params) {
  const startTime = logQueryStart(text);

  try {
    const result = await pool.query(text, params);
    logQueryEnd(startTime, null);
    return result;
  } catch (error) {
    logQueryEnd(startTime, error);
    throw error;
  }
}

async function connect() {
  const client = await pool.connect();

  return {
    query: async (text, params) => {
      const startTime = logQueryStart(text);

      try {
        const result = await client.query(text, params);
        logQueryEnd(startTime, null);
        return result;
      } catch (error) {
        logQueryEnd(startTime, error);
        throw error;
      }
    },

    release: (...args) => client.release(...args),
  };
}

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

export default {
  query,
  connect,
  end: () => pool.end(),
};
