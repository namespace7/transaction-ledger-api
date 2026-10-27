import { Router } from "express";

import pool from "../config/database.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      success: true,
      data: {
        status: "healthy",
        database: "connected",
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
