import { types } from 'cassandra-driver';

import { createClient, createMapper } from './shared/cassandra/cassandra.service';
import { loadCassandraConfig } from './config';

const DEFAULT_CARD = '2291163933867244';

const TXNS: [number, string, string, string, string, string, number, string[]][] = [
  [3, 't-1009', 'Kuhn LLC', 'shopping_net', '919.99', 'DECLINE', 0.8, ['R2', 'R5']],
  [4, 't-1008', 'Kuhn LLC', 'shopping_net', '845.10', 'DECLINE', 0.8, ['R2', 'R5']],
  [6, 't-1007', 'Kuhn LLC', 'shopping_net', '312.40', 'ALLOW', 0.3, ['R5']],
  [95, 't-1006', 'Kirlin and Sons', 'personal_care', '2.86', 'ALLOW', 0, []],
  [180, 't-1005', 'Sporer-Keebler', 'personal_care', '29.84', 'ALLOW', 0, []],
  [26 * 60, 't-1004', 'Swaniawski, Nitzsche and Welch', 'health_fitness', '41.28', 'ALLOW', 0, []],
  [27 * 60, 't-1003', 'Haley Group', 'misc_pos', '60.05', 'STEP_UP', 0.4, ['R4']],
  [50 * 60, 't-1002', 'Johnston-Casper', 'travel', '3.19', 'ALLOW', 0, []],
  [52 * 60, 't-1001', 'Daugherty LLC', 'kids_pets', '19.55', 'ALLOW', 0, []],
];

async function main(): Promise<void> {
  const cardId = process.argv[2] ?? DEFAULT_CARD;
  const client = createClient(loadCassandraConfig());
  const mapper = createMapper(client);
  const txns = mapper.forModel('Txn');
  const alerts = mapper.forModel('Alert');
  const states = mapper.forModel('CardState');
  const opts = { prepare: true };

  for (const table of ['txn_by_card', 'alerts_by_card', 'card_state']) {
    await client.execute(`DELETE FROM ${table} WHERE card_id = ?`, [cardId], opts);
  }

  const now = Date.now();
  let flaggedSum = 0;
  let openAlerts = 0;
  let topScore = 0;
  let topPriority = 0;

  for (const [minutes, txnId, merchant, category, amount, decision, score, rules] of TXNS) {
    const ts = new Date(now - minutes * 60_000);
    const amt = types.BigDecimal.fromString(amount);
    await txns.insert({
      cardId,
      ts,
      txnId,
      merchant,
      category,
      amount: amt,
      decision,
      score,
      firedRules: rules,
      decidedAt: ts,
    });
    for (const rule of rules) {
      const status = decision !== 'ALLOW' ? 'OPEN' : 'CLEARED';
      await alerts.insert({ cardId, ts, alertId: `${txnId}:${rule}`, txnId, ruleId: rule, score, amount: amt, status });
      if (status === 'OPEN') openAlerts++;
    }
    if (decision !== 'ALLOW') {
      flaggedSum += Number(amount);
      topScore = Math.max(topScore, score);
      topPriority = Math.max(topPriority, score * Number(amount));
    }
  }

  await states.insert({
    cardId,
    riskScore: topScore,
    priority: topPriority,
    amountSum: types.BigDecimal.fromString(flaggedSum.toFixed(2)),
    openAlerts,
    lastDecision: 'DECLINE',
    updatedAt: new Date(now),
  });
  await client.shutdown();
  console.log(`seeded ${TXNS.length} transactions for card ${cardId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
