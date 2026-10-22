/**
 * Dev only: writes a few sample rows for one card into the serving tables, so the API and the
 * app have something to show before the fraud-detector -> Kafka Connect -> Cassandra path is live.
 * It first deletes that card's rows (timestamps are relative to now and part of the key,
 * so re-inserting alone would add duplicates). Never point it at a card with real data.
 *
 *   npm run build && npm run seed -- [card_id]
 */
import { types } from 'cassandra-driver';

import { createClient } from './cassandra/cassandra.service';
import { loadConfig } from './config';

const DEFAULT_CARD = '2291163933867244';

// minutes ago, txn_id, merchant, category, amount, decision, score, fired rules
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
  const client = createClient(loadConfig());
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
    await client.execute(
      'INSERT INTO txn_by_card (card_id, ts, txn_id, merchant, category, amount, decision, score, fired_rules, decided_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cardId, ts, txnId, merchant, category, amt, decision, score, rules, ts],
      opts,
    );
    for (const rule of rules) {
      const status = decision !== 'ALLOW' ? 'OPEN' : 'CLEARED';
      await client.execute(
        'INSERT INTO alerts_by_card (card_id, ts, alert_id, txn_id, rule_id, score, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [cardId, ts, `${txnId}:${rule}`, txnId, rule, score, amt, status],
        opts,
      );
      if (status === 'OPEN') openAlerts++;
    }
    if (decision !== 'ALLOW') {
      flaggedSum += Number(amount);
      topScore = Math.max(topScore, score);
      topPriority = Math.max(topPriority, score * Number(amount));
    }
  }

  await client.execute(
    'INSERT INTO card_state (card_id, risk_score, priority, amount_sum, open_alerts, last_decision, updated_at)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?)',
    [cardId, topScore, topPriority, types.BigDecimal.fromString(flaggedSum.toFixed(2)), openAlerts, 'DECLINE', new Date(now)],
    opts,
  );
  await client.shutdown();
  console.log(`seeded ${TXNS.length} transactions for card ${cardId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
