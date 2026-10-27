import { Router } from "express";

import accountController from "../controllers/account.controller.js";
import transactionRoutes from "./transaction.routes.js";

const router = Router();

router.post("/", accountController.create);
router.get("/:id", accountController.getById);
router.use("/:id/transactions", transactionRoutes);

export default router;
