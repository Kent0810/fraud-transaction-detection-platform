package com.cardfraud.frauddetector.topology;

import java.util.concurrent.atomic.AtomicLong;

import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.utils.Bytes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.Topology;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.GlobalKTable;
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
import com.cardfraud.frauddetector.model.FraudMark;
import com.cardfraud.frauddetector.model.Transaction;
import com.cardfraud.frauddetector.rules.Budget;
import com.cardfraud.frauddetector.rules.RecipientId;
import com.cardfraud.frauddetector.rules.BlockedRecipients;
import com.cardfraud.frauddetector.rules.Rules;
import com.cardfraud.frauddetector.rules.Screened;
import com.cardfraud.frauddetector.serde.JsonSerde;

// The processing pipeline, kept apart from main() so it can be tested with TopologyTestDriver.
public final class FraudTopology {
    private static final Logger log = LoggerFactory.getLogger("fraud-detector");

    private FraudTopology() {}

    private static KTable<String, Boolean> buildFrozenRule (KStream<String, ControlEvent> control) {
        Serde<String> keys = Serdes.String();
        Serde<Boolean> flags = Serdes.Boolean();

        return control
                .filter((cardId, event) -> event.isFreezeChange())
                .mapValues(event -> event.freezes())
                .toTable(Materialized.<String, Boolean, KeyValueStore<Bytes, byte[]>>as(CardRules.FROZEN_TABLE)
                        .withKeySerde(keys)
                        .withValueSerde(flags));
    }

    private static KTable<String, Budget> buildBudgetRule(KStream<String, ControlEvent> control) {
        Serde<String> keys = Serdes.String();

        return control
                .filter((cardId, event) -> CardRules.isValidBudget(cardId, event))
                .mapValues(event -> new Budget(event.budgetLimit(), event.budgetPeriod()))
                .toTable(Materialized.<String, Budget, KeyValueStore<Bytes, byte[]>>as(CardRules.BUDGETS_TABLE)
                        .withKeySerde(keys)
                        .withValueSerde(JsonSerde.of(Budget.class)));
    }

    // A change adds to or removes from the card's blocked set so far, hence aggregate and not toTable.
    private static KTable<String, BlockedRecipients> buildBlockedRecipientRule(KStream<String, ControlEvent> control) {
        Serde<String> keys = Serdes.String();
        Serde<ControlEvent> controlSerde = JsonSerde.of(ControlEvent.class);

        return control
                .filter((cardId, event) -> CardRules.isValidRecipientChange(cardId, event))
                .groupByKey(Grouped.with(keys, controlSerde))
                .aggregate(() -> BlockedRecipients.NONE,
                        (cardId, event, blocked) -> CardRules.applyRecipientChange(event, blocked),
                        Materialized.<String, BlockedRecipients, KeyValueStore<Bytes, byte[]>>as(CardRules.BLOCKED_RECIPIENTS_TABLE)
                                .withKeySerde(keys)
                                .withValueSerde(JsonSerde.of(BlockedRecipients.class)));
    }

    public static Topology build(Config cfg) {
        AtomicLong received = new AtomicLong();

        Serde<String> keys = Serdes.String();

        Serde<Transaction> transactionSerde = JsonSerde.of(Transaction.class);
        Serde<Decision> decisionSerde = JsonSerde.of(Decision.class);
        Serde<Alert> alertSerde = JsonSerde.of(Alert.class);
        Serde<CaseSummary> caseSerde = JsonSerde.of(CaseSummary.class);
        Serde<ControlEvent> controlSerde = JsonSerde.of(ControlEvent.class);
        Serde<Boolean> flags = Serdes.Boolean();

        StreamsBuilder builder = new StreamsBuilder();

        KStream<String, ControlEvent> control = builder
                .stream(cfg.controlTopic(), Consumed.with(keys, controlSerde))
                .filter((cardId, event) -> event != null)
                .filter((cardId, event) -> CardRules.hasAction(cardId, event));

        // 0a. Is each card frozen? The cardholder's freeze / unfreeze from the app, latest wins.
        KTable<String, Boolean> frozen = buildFrozenRule(control);

        // 0b. Each card's budget, latest wins.
        KTable<String, Budget> budgets = buildBudgetRule(control);

        // 0c. Recipients each card blocked.
        KTable<String, BlockedRecipients> blockedRecipients = buildBlockedRecipientRule(control);

        // 0d. What each card has spent, for the budget rule in step 2. CardRules.Evaluator reads and updates it.
        CardRules.addSpendStore(builder, keys);
        // 0e. Each card's allowed payments and transfers of the last 30 days, for R4 (amount spike). Also read and updated there.
        CardRules.addPaymentHistoryStore(builder, keys);
        // 0e'. Each card's recent payments and last in-person place, for R5 and R6.
        CardRules.addCardActivityStore(builder, keys);

        // 0f. Recipients confirmed as fraud, bank-wide. Keyed by recipient, not card, so every task needs all of them.
        GlobalKTable<String, FraudMark> fraudMarks = builder.globalTable(
                cfg.fraudMarksTopic(),
                Consumed.with(keys, JsonSerde.of(FraudMark.class)),
                Materialized.<String, FraudMark, KeyValueStore<Bytes, byte[]>>as(CardRules.FRAUD_MARKS_TABLE)
                        .withKeySerde(keys)
                        .withValueSerde(JsonSerde.of(FraudMark.class)));

        // 1. Read transactions as Transaction objects: card payments and app transfers share one topic
        KStream<String, Transaction> transactions = builder
                .stream(cfg.transactionsTopic(), Consumed.with(keys, transactionSerde))
                .filter((cardId, txn) -> txn != null)
                .peek((cardId, txn) -> {
                    long count = received.incrementAndGet();
                    if (count % cfg.logEvery() == 0) {
                        log.info("received {} records (last: key={} txn={})", count, cardId, txn.txnId());
                    }
                });

        // 2. Every transaction -> one decision: DECLINE if the card is frozen, otherwise the rules (Rules.evaluate)
        //    with whether the recipient carries a fraud mark
        //    with the card's recipient rules, budget and spend so far (CardRules.Evaluator)
        KStream<String, Decision> decisions = transactions
                .leftJoin(
                        frozen,
                        (txn, isFrozen) -> Screened.of(txn, Boolean.TRUE.equals(isFrozen)),
                        Joined.with(keys, transactionSerde, flags))
                .leftJoin(
                        fraudMarks,
                        (cardId, screened) -> RecipientId.of(screened.txn()),
                        (screened, mark) -> screened.withFraudMark(mark != null && mark.active()))
                .leftJoin(blockedRecipients,
                        (screened, blocked) -> screened.withBlockedRecipients(blocked))
                .leftJoin(budgets, 
                        (screened, budget) -> screened.withBudget(budget))
                .processValues(() -> new CardRules.Evaluator(cfg.timeScale()), CardRules.SPEND_TABLE,
                        CardRules.PAYMENT_HISTORY_TABLE, CardRules.CARD_ACTIVITY_TABLE);

        // 3. Every decision, card payment or transfer -> decisions topic
        decisions.to(cfg.decisionsTopic(), Produced.with(keys, decisionSerde));

        // 4. Every fired rule -> one alert (details: Alert.fromDecision)
        decisions.flatMapValues(d -> Alert.fromDecision(d))
                .to(cfg.alertsTopic(), Produced.with(keys, alertSerde));

        // 5. Every decision an analyst should review updates the card's case (details: CaseSummary.update).
        //    The key (card id) never changes, so no repartition.
        decisions.filter((cardId, d) -> Rules.needsReview(d))
                .groupByKey(Grouped.with(keys, decisionSerde))
                .aggregate(() -> CaseSummary.EMPTY,
                        (cardId, d, summary) -> summary.update(cardId, d),
                        Materialized.<String, CaseSummary, KeyValueStore<Bytes, byte[]>>as(CardRules.CASE_SUMMARIES_TABLE)
                                .withKeySerde(keys)
                                .withValueSerde(caseSerde))
                .toStream()
                .to(cfg.casesTopic(), Produced.with(keys, caseSerde));

        return builder.build();
    }
}
