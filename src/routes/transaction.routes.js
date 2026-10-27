import { Router } from "express";

import transactionController from "../controllers/transaction.controller.js";

const router = Router({ mergeParams: true });

router.post("/", transactionController.create);
router.get("/", transactionController.history);
router.get("/balance", transactionController.balance);

export default router;
