import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';

import { parseDelayNotice, ParseError } from './parser.js';
import {
  SingleParseRequestSchema,
  BulkParseRequestSchema,
  SingleParseResponseSchema,
  BulkParseResponseSchema,
} from './schema.js';

dotenv.config();

// Server-side Constants & Configuration (Test Cases 2, 5, 6)
export const NETWORK_IDENTIFIER = 'eip155:84532'; // Base Sepolia Testnet
export const SINGLE_PARSE_PRICE = '$0.001';
export const BULK_PARSE_PRICE = '$0.005';
export const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS || '0x0000000000000000000000000000000000000000';
export const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://x402.org/facilitator';

export function createServer() {
  const app = express();

  // Serve static dashboard assets from public folder
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Test Case 8: Server-side request body size limit (capped at 10kb)
  app.use(express.json({ limit: '10kb' }));

  // Custom middleware to catch oversized payloads (Test Case 8)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: 'Request body exceeds the maximum permitted size limit of 10KB.',
      });
    }
    next(err);
  });

  // Setup x402 Resource Server & Payment Middleware (Test Cases 1, 2, 5, 6)
  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    NETWORK_IDENTIFIER,
    new ExactEvmScheme()
  );

  const routesConfig = {
    'POST /api/parse': {
      accepts: [
        {
          scheme: 'exact',
          price: SINGLE_PARSE_PRICE,
          network: NETWORK_IDENTIFIER,
          payTo: PAY_TO_ADDRESS,
        },
      ],
      description: "Meera's Railway Delay API: Single Notice Parse ($0.001 USDC)",
      mimeType: 'application/json',
    },
    'POST /api/bulk-parse': {
      accepts: [
        {
          scheme: 'exact',
          price: BULK_PARSE_PRICE,
          network: NETWORK_IDENTIFIER,
          payTo: PAY_TO_ADDRESS,
        },
      ],
      description: "Meera's Railway Delay API: Bulk Notice Parse ($0.005 USDC)",
      mimeType: 'application/json',
    },
  };

  app.use(paymentMiddleware(routesConfig as any, resourceServer));

  // --- FREE ROUTES ---

  // Interactive Web Dashboard & Root Endpoint
  app.get('/', (req: Request, res: Response) => {
    const indexPath = path.resolve(process.cwd(), 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    res.json({
      name: "Meera's Railway Delay API",
      description: "Converts messy Indian Railways station delay notices into clean JSON.",
      policy: "Nobody pays for a notice Meera couldn't read. If parsing fails, your coin is preserved.",
      routes: {
        free: ['GET /', 'GET /api/health', 'GET /api/samples', 'POST /api/parse-free'],
        paid: [
          { path: 'POST /api/parse', price: SINGLE_PARSE_PRICE, network: NETWORK_IDENTIFIER },
          { path: 'POST /api/bulk-parse', price: BULK_PARSE_PRICE, network: NETWORK_IDENTIFIER },
        ],
      },
    });
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: "Meera's Railway Delay API", network: NETWORK_IDENTIFIER });
  });

  // Free sample notices endpoint
  app.get('/api/samples', (req: Request, res: Response) => {
    try {
      const samplesDir = path.resolve(process.cwd(), 'samples');
      if (!fs.existsSync(samplesDir)) {
        return res.status(404).json({ error: 'Samples directory not found' });
      }

      const files = fs.readdirSync(samplesDir);
      const samples = files.map((file) => ({
        filename: file,
        content: fs.readFileSync(path.join(samplesDir, file), 'utf-8').trim(),
        isWellFormed: file.startsWith('well_formed'),
      }));

      res.json({ samples });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to read samples', details: error.message });
    }
  });

  // Free parse route (for testing without payment header)
  app.post('/api/parse-free', (req: Request, res: Response) => {
    try {
      // Validate input schema & notice length limit
      const bodyValidation = SingleParseRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          error: 'Invalid Request Input',
          details: bodyValidation.error.errors,
        });
      }

      const { notice } = bodyValidation.data;

      // Additional input length cap check (Test Case 8)
      if (notice.length > 2000) {
        return res.status(400).json({
          error: 'Input Size Exceeded',
          message: 'Notice text exceeds the maximum character limit of 2000.',
        });
      }

      // Parse notice (Test Case 7 & 9)
      const parsed = parseDelayNotice(notice);

      res.json(SingleParseResponseSchema.parse({ success: true, data: parsed }));
    } catch (err: any) {
      if (err instanceof ParseError) {
        return res.status(422).json({
          error: 'Unparseable Notice',
          message: err.message,
        });
      }
      res.status(400).json({ error: 'Parsing Failed', message: err.message || 'Unknown error' });
    }
  });

  // --- PAID ROUTES (x402 protected) ---

  // Paid route 1: Single Notice Parse ($0.001)
  app.post('/api/parse', (req: Request, res: Response) => {
    try {
      // Validate input schema
      const bodyValidation = SingleParseRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        // Test Case 7: Return 4xx HTTP status on failure so x402 does not settle payment!
        return res.status(400).json({
          error: 'Invalid Request Input',
          details: bodyValidation.error.errors,
        });
      }

      const { notice } = bodyValidation.data;

      // Input length cap check (Test Case 8)
      if (notice.length > 2000) {
        return res.status(400).json({
          error: 'Input Size Exceeded',
          message: 'Notice text exceeds the maximum character limit of 2000.',
        });
      }

      // Parse notice with schema validation inside parseDelayNotice (Test Case 9)
      const parsed = parseDelayNotice(notice);

      // Return clean JSON (HTTP 200 triggers successful payment settlement)
      res.json(SingleParseResponseSchema.parse({ success: true, data: parsed }));
    } catch (err: any) {
      // Test Case 7: Return 4xx status (422 or 400) when notice is garbage/unparseable!
      if (err instanceof ParseError) {
        return res.status(422).json({
          error: 'Unparseable Notice',
          message: err.message,
        });
      }
      res.status(400).json({
        error: 'Parsing Failed',
        message: err.message || 'Unknown error during notice parsing',
      });
    }
  });

  // Paid route 2: Bulk Notice Parse ($0.005)
  app.post('/api/bulk-parse', (req: Request, res: Response) => {
    try {
      // Validate bulk request input schema
      const bodyValidation = BulkParseRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          error: 'Invalid Bulk Request Input',
          details: bodyValidation.error.errors,
        });
      }

      const { notices } = bodyValidation.data;

      const parsedResults = [];

      for (let i = 0; i < notices.length; i++) {
        const notice = notices[i];
        if (notice.length > 2000) {
          return res.status(400).json({
            error: 'Input Size Exceeded',
            message: `Notice at index ${i} exceeds maximum character limit of 2000.`,
          });
        }
        // If any notice in bulk fails to parse, entire batch fails with 4xx
        // Meera's rule: nobody pays for notices that can't be parsed!
        const parsed = parseDelayNotice(notice);
        parsedResults.push(parsed);
      }

      const responsePayload = {
        success: true,
        total: parsedResults.length,
        data: parsedResults,
      };

      res.json(BulkParseResponseSchema.parse(responsePayload));
    } catch (err: any) {
      if (err instanceof ParseError) {
        return res.status(422).json({
          error: 'Bulk Notice Parsing Failed',
          message: err.message,
        });
      }
      res.status(400).json({
        error: 'Bulk Parsing Failed',
        message: err.message || 'Unknown error during bulk notice parsing',
      });
    }
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
    });
  });

  return app;
}
