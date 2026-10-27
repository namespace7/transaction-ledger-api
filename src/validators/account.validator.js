import { z } from "zod";

export const createAccountSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(150, "Name must not exceed 150 characters."),
  })
  .strict();
