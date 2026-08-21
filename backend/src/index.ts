import app from './app';
import { config } from './config';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(` ChamaVault Fee Sponsorship Relayer Middleware Started      `);
  console.log(` Running on Port: ${PORT}                                    `);
  console.log(` Environment:     ${config.nodeEnv}                          `);
  console.log(` Stellar Network: ${config.stellarNetwork}                   `);
  console.log(`=============================================================`);
});
