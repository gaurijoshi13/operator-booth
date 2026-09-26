import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server.js';

describe('Meera Railway Delay API Server HTTP Endpoints', () => {
  const app = createServer();

  it('GET /api/health should return status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.network).toBe('eip155:84532');
  });

  it('GET /api/samples should return sample files', async () => {
    const res = await request(app).get('/api/samples');
    expect(res.status).toBe(200);
    expect(res.body.samples).toBeDefined();
    expect(Array.isArray(res.body.samples)).toBe(true);
    expect(res.body.samples.length).toBeGreaterThan(0);
  });

  it('POST /api/parse-free with valid notice returns 200 and clean JSON', async () => {
    const notice = 'TRAIN NO: 12123 | STATION: PUNE | NEW EXPECTED TIME: 14:30 | REASON: Signal failure';
    const res = await request(app).post('/api/parse-free').send({ notice });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.train).toContain('12123');
    expect(res.body.data.station).toBe('PUNE');
    expect(res.body.data.expectedTime).toBe('14:30');
  });

  // Test Case 7 & 10: Unparseable notice returns 4xx status (422)
  it('POST /api/parse-free with malformed notice returns HTTP 422', async () => {
    const notice = 'Station PUNE expected time 15:30. Reason: Engine failure.'; // missing train
    const res = await request(app).post('/api/parse-free').send({ notice });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Unparseable Notice');
  });

  // Test Case 1 & 2: Paid route returns 402 with x402 payment requirements on testnet
  it('POST /api/parse without payment header returns HTTP 402 Payment Required', async () => {
    const notice = 'TRAIN NO: 12123 | STATION: PUNE | NEW EXPECTED TIME: 14:30';
    const res = await request(app).post('/api/parse').send({ notice });

    expect(res.status).toBe(402);
    
    // x402 middleware returns payment requirements in 'payment-required' header (base64 encoded JSON)
    const paymentHeader = res.headers['payment-required'] || res.headers['x-payment-required'] || '';
    const decodedHeader = paymentHeader ? Buffer.from(paymentHeader, 'base64').toString('utf-8') : '';
    const combinedStr = `${decodedHeader} ${JSON.stringify(res.headers)} ${JSON.stringify(res.body)} ${res.text || ''}`;

    expect(combinedStr).toContain('eip155:84532');
  });

  it('POST /api/bulk-parse without payment header returns HTTP 402 Payment Required', async () => {
    const notices = ['TRAIN NO: 12123 | STATION: PUNE | NEW EXPECTED TIME: 14:30'];
    const res = await request(app).post('/api/bulk-parse').send({ notices });

    expect(res.status).toBe(402);

    const paymentHeader = res.headers['payment-required'] || res.headers['x-payment-required'] || '';
    const decodedHeader = paymentHeader ? Buffer.from(paymentHeader, 'base64').toString('utf-8') : '';
    const combinedStr = `${decodedHeader} ${JSON.stringify(res.headers)} ${JSON.stringify(res.body)} ${res.text || ''}`;

    expect(combinedStr).toContain('eip155:84532');
  });

  // Test Case 8: Server-side input size capping
  it('POST /api/parse-free rejects notice exceeding character limit', async () => {
    const oversizedNotice = 'A'.repeat(2500);
    const res = await request(app).post('/api/parse-free').send({ notice: oversizedNotice });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
