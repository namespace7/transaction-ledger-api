import { z } from "zod";

export const createTransferSchema = z
  .object({
    source_account_id: z.string().uuid(),
    destination_account_id: z.string().uuid(),
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
  .strict()
  .refine((data) => data.source_account_id !== data.destination_account_id, {
    message: "Source and destination accounts must be different.",
    path: ["destination_account_id"],
  });
