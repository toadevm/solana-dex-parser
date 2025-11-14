require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { DexParser } = require('./dist');

const AXIOM_FEE = '8m5GkL7nVy95G4YVUbs79z873oVKqg2afgKRmqxsiiRm';
const PADRE_FEE = 'jitodontfront11111111111TradeWithPadreDotGg';

const processedSigs = new Set();

async function monitorLive() {
  console.log('\n' + '='.repeat(80));
  console.log('  LIVE: AXIOM & PADRE TRANSACTION MONITOR');
  console.log('='.repeat(80));
  console.log('\nMonitoring blockchain for new Axiom and Padre trades...\n');
  console.log('Press Ctrl+C to stop\n');
  console.log('-'.repeat(80) + '\n');

  const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
  const parser = new DexParser();

  // Monitor function
  async function checkForNewTransactions() {
    try {
      // Check Axiom
      const axiomSigs = await connection.getSignaturesForAddress(
        new PublicKey(AXIOM_FEE),
        { limit: 5 }
      );

      // Check Padre
      const padreSigs = await connection.getSignaturesForAddress(
        new PublicKey(PADRE_FEE),
        { limit: 5 }
      );

      // Process new Axiom transactions
      for (const sigInfo of axiomSigs) {
        if (sigInfo.err || processedSigs.has(sigInfo.signature)) continue;
        processedSigs.add(sigInfo.signature);
        await processTransaction(sigInfo.signature, 'Axiom', connection, parser);
      }

      // Process new Padre transactions
      for (const sigInfo of padreSigs) {
        if (sigInfo.err || processedSigs.has(sigInfo.signature)) continue;
        processedSigs.add(sigInfo.signature);
        await processTransaction(sigInfo.signature, 'Padre', connection, parser);
      }

    } catch (error) {
      console.error('WARNING: Monitoring error:', error.message);
    }
  }

  // Initial check
  await checkForNewTransactions();

  // Poll every 3 seconds
  setInterval(checkForNewTransactions, 3000);
}

async function processTransaction(signature, expectedBot, connection, parser) {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return;

    const result = await parser.parseAll(tx);

    if (result.trades && result.trades.length > 0) {
      const trade = result.trades[0];

      // Only show if it matches our expected bot
      if (trade.route === expectedBot) {
        const timestamp = new Date(trade.timestamp * 1000).toLocaleTimeString();

        console.log(`NEW ${trade.route.toUpperCase()} TRADE DETECTED!`);
        console.log(`   Time: ${timestamp}`);
        console.log(`   Signature: ${signature}`);
        console.log(`   Route: ${trade.route}`);
        console.log(`   AMM: ${trade.amm}`);
        console.log(`   Type: ${trade.type}`);
        console.log(`   User: ${trade.user}`);
        console.log(`   Amount: ${trade.inputToken.amount.toFixed(4)} -> ${trade.outputToken.amount.toFixed(4)}`);
        console.log('-'.repeat(80) + '\n');
      }
    }
  } catch (error) {
    // Silently skip errors for cleaner output
  }
}

monitorLive().catch(console.error);
