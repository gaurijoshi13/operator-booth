import { z } from 'zod';

/**
 * Output schema for a parsed delay notice.
 * Must include train, station, expectedTime, and optional reason.
 */
export const ParsedDelayNoticeSchema = z.object({
  train: z.string().min(1, "Train number/name is required"),
  station: z.string().min(1, "Station code is required"),
  expectedTime: z.string().min(1, "Expected time is required"),
  reason: z.string().nullable().optional(),
});

export type ParsedDelayNotice = z.infer<typeof ParsedDelayNoticeSchema>;

/**
 * Input schema for single notice parsing request.
 */
export const SingleParseRequestSchema = z.object({
  notice: z
    .string({ required_error: "Notice text is required" })
    .min(1, "Notice text cannot be empty")
    .max(2000, "Notice text exceeds maximum length of 2000 characters"),
});

export type SingleParseRequest = z.infer<typeof SingleParseRequestSchema>;

/**
 * Input schema for bulk notice parsing request.
 */
export const BulkParseRequestSchema = z.object({
  notices: z
    .array(
      z.string().min(1, "Notice text cannot be empty").max(2000, "Notice text exceeds maximum length of 2000 characters")
    )
    .min(1, "At least one notice must be provided")
    .max(20, "Bulk requests are capped at 20 notices maximum"),
});

export type BulkParseRequest = z.infer<typeof BulkParseRequestSchema>;

/**
 * API response format for single notice.
 */
export const SingleParseResponseSchema = z.object({
  success: z.boolean(),
  data: ParsedDelayNoticeSchema,
});

/**
 * API response format for bulk notices.
 */
export const BulkParseResponseSchema = z.object({
  success: z.boolean(),
  total: z.number(),
  data: z.array(ParsedDelayNoticeSchema),
});
