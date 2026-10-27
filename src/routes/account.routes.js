import { Router } from "express";

import accountController from "../controllers/account.controller.js";

const router = Router();

router.post("/", accountController.create);
router.get("/:id", accountController.getById);

export default router;
