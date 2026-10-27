import transactionService from "../services/transaction.service.js";
import {
  accountIdSchema,
  createTransactionSchema,
  transactionHistorySchema,
} from "../validators/transaction.validator.js";

function validateAccountId(req, res) {
  const result = accountIdSchema.safeParse(req.params.id);

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_ACCOUNT_ID",
        message: "Account ID must be a valid UUID.",
      },
    });

    return false;
  }

  return true;
}

async function create(req, res, next) {
  try {
    if (!validateAccountId(req, res)) return;

    const validation = createTransactionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid transaction data.",
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    const result = await transactionService.createTransaction(
      req.params.id,
      validation.data,
    );

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function balance(req, res, next) {
  try {
    if (!validateAccountId(req, res)) return;

    const account = await transactionService.getBalance(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ACCOUNT_NOT_FOUND",
          message: "Account not found",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { accountId: account.id, balance: account.balance },
    });
  } catch (error) {
    return next(error);
  }
}

async function history(req, res, next) {
  try {
    if (!validateAccountId(req, res)) return;

    const validation = transactionHistorySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid transaction history filters.",
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    const result = await transactionService.getHistory(
      req.params.id,
      validation.data,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
export default {
  create,
  balance,
  history,
};
