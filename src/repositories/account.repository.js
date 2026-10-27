import pool from "../config/database.js";

async function create(name) {
  const query = `INSERT INTO accounts (name) VALUES ($1) RETURNING id, name, balance, created_at`;

  const result = await pool.query(query, [name]);

  return result.rows[0];
}

async function findById(id) {
  const query = `SELECT id, name, balance, created_at from accounts WHERE id= $1 `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
}

export default {
  create,
  findById,
};
