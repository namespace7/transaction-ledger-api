import { z } from "zod";

export const createTransactionSchema = z
  .object({
    type: z.enum(["credit", "debit"]),
    amount: z
      .number()
      .positive()
      .refine(
        (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8,
        "Amount must have at most two decimal places.",
      ),
    description: z
      .string()
      .trim()
      .min(1, "Description is required.")
      .max(1000, "Description must not exceed 1000 characters."),
    reference_id: z
      .string()
      .trim()
      .min(1, "Reference ID is required.")
      .max(255, "Reference ID must not exceed 255 characters."),
  })
  .strict();

export const accountIdSchema = z.string().uuid();

export const transactionHistorySchema = z
  .object({
    type: z.enum(["credit", "debit"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
