import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { privateKeyToAccount } from 'viem/accounts';
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';

dotenv.config();

async function main() {
  console.log("=================================================");
  console.log("🚆 Meera's Railway Delay API - Buyer Client (x402)");
  console.log("=================================================");

  // Read credentials strictly from environment variables (Test Case 4)
  const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;

  if (!privateKey || privateKey.includes("0000000000000000000000000000000000000000")) {
    console.error("❌ Error: EVM_PRIVATE_KEY environment variable is missing or placeholder.");
    console.error("Please copy .env.example to .env and set a valid Base Sepolia testnet EVM_PRIVATE_KEY.");
    process.exit(1);
  }

  // Setup Viem Account and x402 Client Signer
  const account = privateKeyToAccount(privateKey);
  console.log(`🔑 Buyer Wallet Address: ${account.address}`);

  const signer = toClientEvmSigner(account);
  const client = new x402Client();
  registerExactEvmScheme(client, signer);

  // Wrap standard fetch with x402 payment handling (Test Case 3)
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const serverUrl = process.env.API_URL || 'http://localhost:3000';
  const targetEndpoint = `${serverUrl}/api/parse`;

  // Read sample notice text
  let sampleNotice = "TRAIN NO: 12123 (Deccan Queen) | STATION: PUNE | NEW EXPECTED TIME: 14:30 | REASON: Signal failure near Lonavala / सिग्नल बिघाड";
  const samplePath = path.resolve(process.cwd(), 'samples', 'well_formed_1.txt');
  if (fs.existsSync(samplePath)) {
    sampleNotice = fs.readFileSync(samplePath, 'utf-8').trim();
  }

  console.log(`\n📄 Submitting notice to paid endpoint (${targetEndpoint}):`);
  console.log(`"${sampleNotice}"\n`);

  try {
    const response = await fetchWithPayment(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notice: sampleNotice }),
    });

    const status = response.status;
    const data = await response.json();

    console.log(`Status Code: ${status}`);
    console.log("Response Body:");
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("\n✅ Payment completed successfully & clean JSON received!");
    } else {
      console.log("\n⚠️ Request failed or notice was unparseable. Caller kept their coin.");
    }
  } catch (error: any) {
    console.error("\n❌ Request Error:", error.message || error);
  }
}

if (process.argv[1]?.endsWith('buyer.ts') || process.argv[1]?.endsWith('buyer.js')) {
  main().catch((err) => {
    console.error("Fatal buyer error:", err);
    process.exit(1);
  });
}
