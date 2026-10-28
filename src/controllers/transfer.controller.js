
import transactionService from "../services/transaction.service.js";
import { createTransferSchema } from "../validators/transfer.validator.js";

async function create(req, res, next) {
  try {
    const validation = createTransferSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid transfer data.",
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    const result = await transactionService.transfer(validation.data);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export default { create };
