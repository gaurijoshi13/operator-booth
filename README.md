# 🚆 Meera's Railway Delay API — The Operator's Booth

Meera is a retired Indian Railways clerk in Pune. Every morning she reads messy, half-structured station delay notices (train number, station code, expected time, and optional reason in English, Marathi, or Hindi) and parses them into clean JSON.

This repository implements Meera's Railway Delay API gated with **x402 pay-per-call micropayments** on the **Base Sepolia testnet (`eip155:84532`)**.

---

## ⚡ Key Principles & Meera's Firm Rule

1. **Drop a Coin Per Call**: Each single parse costs **$0.001 USDC** and bulk parse costs **$0.005 USDC**, settled on Base Sepolia.
2. **Verify-Then-Settle Guarantee**: *Nobody pays for a notice Meera couldn't read.* If a delay notice is malformed or unparseable, the handler responds with an HTTP **4xx status (422 / 400)**. In the x402 lifecycle, payment settlement only triggers on 2xx responses. When parsing fails, payment settlement is skipped and the caller keeps their coin.
3. **Server-Controlled Pricing**: Prices and payment recipients (`payTo`) are server-side constants and environment variables. Callers cannot modify or manipulate prices.
4. **Input & Schema Safety**: Body sizes are capped at 10KB server-side with notice character limits. All outputs are strictly validated against a Zod schema before being returned.

---

## 📁 Repository Structure

```
.
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── samples/
│   ├── well_formed_1.txt    # Standard notice with Marathi reason
│   ├── well_formed_2.txt    # Notice with AM/PM time format
│   ├── well_formed_3.txt    # Notice with shorthand keys (Trn, Stn, Exp)
│   ├── well_formed_4.txt    # Notice without reason
│   ├── broken_1.txt         # Malformed notice (missing train number)
│   ├── broken_2.txt         # Malformed notice (missing station code)
│   └── broken_3.txt         # Malformed notice (garbage text)
├── src/
│   ├── schema.ts            # Zod schemas for input/output validation
│   ├── parser.ts            # Railway delay notice parser
│   ├── server.ts            # Express server with @x402/express middleware
│   ├── index.ts             # Server entry point
│   └── buyer.ts             # Buyer script using @x402/fetch client
└── tests/
    ├── parser.test.ts       # Unit tests for parser logic & malformed notices
    └── server.test.ts       # Integration tests for HTTP routes & 402 gating
```

---

## 🌐 API Routes

### Free Routes
- `GET /` — API metadata, policy, and available routes.
- `GET /api/health` — Service status check.
- `GET /api/samples` — Returns sample delay notice text files.
- `POST /api/parse-free` — Free tier parse endpoint for testing parser without payment.

### Paid Routes (x402 Protected)
- `POST /api/parse` — Parse a single delay notice (**$0.001 USDC**, `eip155:84532`).
- `POST /api/bulk-parse` — Bulk parse up to 20 notices (**$0.005 USDC**, `eip155:84532`).

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js **20.12+** or **22 LTS**
- npm / npx

### 1. Installation

```bash
git clone <your-repo-url>
cd operator-booth
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your testnet configuration:

```env
EVM_PRIVATE_KEY=0x... (Your Base Sepolia testnet EVM private key)
PAY_TO_ADDRESS=0x...  (Recipient wallet address for USDC payments)
FACILITATOR_URL=https://x402.org/facilitator
PORT=3000
```

> 💡 **Note**: Testnet USDC on Base Sepolia can be obtained from the free [Circle Testnet Faucet](https://faucet.circle.com/).

### 3. Run Automated Tests

Run the Vitest test suite to test parser accuracy, malformed notice error handling, and x402 HTTP 402 payment requirements gating:

```bash
npm test
```

### 4. Start the API Server

```bash
npm start
# Or for dev mode:
npm run dev
```

The server will listen on `http://localhost:3000`.

### 5. Run the Buyer Script

In a separate terminal, execute the x402 buyer script to make a paid API call:

```bash
npm run buyer
```

---

## 🧪 Sample Parser Output Example

### Input (Notice text):
```
TRAIN NO: 12123 (Deccan Queen) | STATION: PUNE | NEW EXPECTED TIME: 14:30 | REASON: Signal failure near Lonavala / सिग्नल बिघाड
```

### Output (JSON Response):
```json
{
  "success": true,
  "data": {
    "train": "12123 (Deccan Queen)",
    "station": "PUNE",
    "expectedTime": "14:30",
    "reason": "Signal failure near Lonavala / सिग्नल बिघाड"
  }
}
```

---

## 🛡️ Verification & Security Compliance

- **No Hardcoded Secrets**: All credentials and private keys are strictly loaded from `process.env`.
- **x402 Facilitator**: Uses `https://x402.org/facilitator` on network `eip155:84532` (Base Sepolia).
- **Zod Output Validation**: Enforces exact schema rules on parsed outputs.
# operator-booth
