package com.cardfraud.frauddetector.rules;

import java.util.Objects;

import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.utils.Bytes;
import org.apache.kafka.streams.kstream.Grouped;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.Materialized;
import org.apache.kafka.streams.kstream.Produced;
import org.apache.kafka.streams.state.KeyValueStore;

import com.cardfraud.frauddetector.model.Alert;
import com.cardfraud.frauddetector.model.Transaction;
import com.cardfraud.frauddetector.serde.JsonSerde;

// TEST ONLY, not part of the real rule set. The third (and every further) transfer in a row from a card to the same
// account for the same amount raises a MOCK_REPEAT alert; the transfer itself is not held or declined.
// To remove: delete this file and the MockRepeatTransferRule line in FraudTopology.
public final class MockRepeatTransferRule {
    public static final String RULE = "MOCK_REPEAT";
    private static final int IN_A_ROW = 3;

    private MockRepeatTransferRule() {
    }

    // The card's latest transfer, and how many transfers in a row (this one included) went to its account for its amount.
    public record Streak(String txnId, String ts, String account, long amount, int count) {
        static final Streak NONE = new Streak(null, null, null, 0, 0);

        Streak next(Transaction t) {
            boolean same = t.counterpartyAccount() != null
                    && Objects.equals(t.counterpartyAccount(), account)
                    && t.amt() == amount;
            return new Streak(t.txnId(), t.ts(), t.counterpartyAccount(), t.amt(), same ? count + 1 : 1);
        }
    }

    public static void wire(KStream<String, Transaction> transfers,
                            Serde<String> keys,
                            Serde<Transaction> transactionSerde,
                            Serde<Alert> alertSerde,
                            String alertsTopic) {
        transfers.groupByKey(Grouped.with(keys, transactionSerde))
                .aggregate(() -> Streak.NONE,
                        (cardId, transfer, streak) -> streak.next(transfer),
                        Materialized.<String, Streak, KeyValueStore<Bytes, byte[]>>as("mock-repeat-transfers")
                                .withKeySerde(keys)
                                .withValueSerde(JsonSerde.of(Streak.class))
                                .withCachingDisabled())
                .toStream()
                .filter((cardId, streak) -> streak.count() >= IN_A_ROW)
                .mapValues((cardId, streak) -> new Alert(
                        streak.txnId() + ":" + RULE,
                        cardId,
                        streak.txnId(),
                        RULE,
                        1.0,
                        streak.amount(),
                        streak.ts()))
                .to(alertsTopic, Produced.with(keys, alertSerde));
    }
}
