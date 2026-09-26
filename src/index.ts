import dotenv from 'dotenv';
import { createServer } from './server.js';

dotenv.config();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = createServer();

app.listen(port, () => {
  console.log(`====================================================`);
  console.log(`🚆 Meera's Railway Delay API is running on port ${port}`);
  console.log(`Network: eip155:84532 (Base Sepolia Testnet)`);
  console.log(`Free endpoints:  GET /api/health, GET /api/samples, POST /api/parse-free`);
  console.log(`Paid endpoints: POST /api/parse ($0.001), POST /api/bulk-parse ($0.005)`);
  console.log(`====================================================`);
});
