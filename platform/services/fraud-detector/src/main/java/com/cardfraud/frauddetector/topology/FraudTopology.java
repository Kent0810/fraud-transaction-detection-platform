package com.cardfraud.frauddetector.topology;

import java.util.concurrent.atomic.AtomicLong;

import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.utils.Bytes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.Topology;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.Grouped;
import org.apache.kafka.streams.kstream.Joined;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.KTable;
import org.apache.kafka.streams.kstream.Materialized;
import org.apache.kafka.streams.kstream.Produced;
import org.apache.kafka.streams.state.KeyValueStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.cardfraud.frauddetector.config.Config;
import com.cardfraud.frauddetector.model.Alert;
import com.cardfraud.frauddetector.model.CaseSummary;
import com.cardfraud.frauddetector.model.ControlEvent;
import com.cardfraud.frauddetector.model.Decision;
import com.cardfraud.frauddetector.model.Transaction;
import com.cardfraud.frauddetector.model.TransferDecision;
import com.cardfraud.frauddetector.rules.MockRepeatTransferRule;
import com.cardfraud.frauddetector.rules.Rules;
import com.cardfraud.frauddetector.rules.TransferRules;
import com.cardfraud.frauddetector.serde.JsonSerde;

// The processing pipeline, kept apart from main() so it can be tested with TopologyTestDriver.
public final class FraudTopology {
    private static final Logger log = LoggerFactory.getLogger("fraud-detector");

    private FraudTopology() {}

    public static Topology build(Config cfg) {
        AtomicLong received = new AtomicLong();

        Serde<String> keys = Serdes.String();
        
        Serde<Transaction> transactionSerde = JsonSerde.of(Transaction.class);
        Serde<Decision> decisionSerde = JsonSerde.of(Decision.class);
        Serde<Alert> alertSerde = JsonSerde.of(Alert.class);
        Serde<CaseSummary> caseSerde = JsonSerde.of(CaseSummary.class);
        Serde<ControlEvent> controlSerde = JsonSerde.of(ControlEvent.class);
        Serde<TransferDecision> transferDecisionSerde = JsonSerde.of(TransferDecision.class);
        Serde<Boolean> flags = Serdes.Boolean();

        StreamsBuilder builder = new StreamsBuilder();

        // 0. Is each card frozen? The cardholder's freeze / unfreeze from the app, latest wins.
        KTable<String, Boolean> frozen = builder
                .stream(cfg.controlTopic(), Consumed.with(keys, controlSerde))
                .filter((cardId, event) -> event != null && event.isFreezeChange())
                .mapValues(ControlEvent::freezes)
                .toTable(Materialized.<String, Boolean, KeyValueStore<Bytes, byte[]>>as("frozen-accounts")
                        .withKeySerde(keys)
                        .withValueSerde(flags));

        // 1. Read transactions as Transaction objects: card payments and app transfers
        KStream<String, Transaction> cardPayments = builder
                .stream(cfg.transactionsTopic(), Consumed.with(keys, transactionSerde))
                .peek((cardId, txn) -> {
                    long count = received.incrementAndGet();
                    if (count % cfg.logEvery() == 0) {
                        log.info("received {} records (last: key={} txn={})", count, cardId, txn.txnId());
                    }
                });
        KStream<String, Transaction> transfers = builder
                .stream(cfg.transferRequestsTopic(), Consumed.with(keys, transactionSerde))
                .filter((cardId, transfer) -> transfer != null);
        KStream<String, Transaction> transactions = cardPayments.merge(transfers);

        // 2. Every transaction -> one decision: DECLINE if the card is frozen, otherwise the rules (Rules.evaluate)
        KStream<String, Decision> decisions = transactions.leftJoin(
                frozen,
                (cardId, txn, isFrozen) -> Boolean.TRUE.equals(isFrozen)
                        ? Rules.frozen(cardId, txn)
                        : Rules.evaluate(cardId, txn),
                Joined.with(keys, transactionSerde, flags));

        // 3. Every card payment's decision -> decisions topic
        decisions.filter((cardId, d) -> Transaction.CARD.equals(d.channel()))
                .to(cfg.decisionsTopic(), Produced.with(keys, decisionSerde));

        // 6. Every transfer's decision -> transfer-decisions topic
        decisions.filter((cardId, d) -> Transaction.TRANSFER.equals(d.channel()))
                .mapValues(TransferRules::decide)
                .peek((cardId, d) -> log.info("transfer {} {} {}", d.txnId(), d.decision(), d.firedRules()))
                .to(cfg.transferDecisionsTopic(), Produced.with(keys, transferDecisionSerde));

        // 4. Every fired rule -> one alert (details: Alert.fromDecision)
        decisions.flatMapValues(Alert::fromDecision)
                .to(cfg.alertsTopic(), Produced.with(keys, alertSerde));

        // TEST ONLY: repeated same-amount transfers to one account -> MOCK_REPEAT alert. Delete with its file.
        MockRepeatTransferRule.wire(transfers, keys, transactionSerde, alertSerde, cfg.alertsTopic());

        // 5. Every non-ALLOW decision updates the card's case (details: CaseSummary.update).
        //    The key (card id) never changes, so no repartition.
        decisions.filter((cardId, d) -> d.decision() != Decision.Verdict.ALLOW)
                .groupByKey(Grouped.with(keys, decisionSerde))
                .aggregate(() -> CaseSummary.EMPTY,
                        (cardId, d, summary) -> summary.update(cardId, d),
                        Materialized.<String, CaseSummary, KeyValueStore<Bytes, byte[]>>as("case-summaries")
                                .withKeySerde(keys)
                                .withValueSerde(caseSerde))
                .toStream()
                .to(cfg.casesTopic(), Produced.with(keys, caseSerde));

        return builder.build();
    }
}
