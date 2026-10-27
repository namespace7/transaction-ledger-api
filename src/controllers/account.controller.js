import accountService from "../services/account.service.js";
import { createAccountSchema } from "../validators/account.validator.js";

async function create(req, res, next) {
  try {
    const validation = createAccountSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid account data.",
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    const account = await accountService.createAccount(validation.data.name);

    return res.status(201).json({
      success: true,
      data: { account },
    });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const account = await accountService.getAccount(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ACCOUNT_NOT_FOUND",
          message: "Account not found.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { account },
    });
  } catch (error) {
    return next(error);
  }
}

export default {
  create,
  getById,
};
