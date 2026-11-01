package com.cardfraud.frauddetector.topology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;

import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.apache.kafka.streams.TestInputTopic;
import org.apache.kafka.streams.TestOutputTopic;
import org.apache.kafka.streams.TopologyTestDriver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.cardfraud.frauddetector.config.Config;
import com.cardfraud.frauddetector.model.Alert;
import com.cardfraud.frauddetector.model.ControlEvent;
import com.cardfraud.frauddetector.model.Decision;
import com.cardfraud.frauddetector.model.Decision.Verdict;
import com.cardfraud.frauddetector.model.Transaction;
import com.cardfraud.frauddetector.serde.JsonSerde;

class CardRulesTopologyTest {
    private static final String CARD = "2291163933867244";
    private static final String SHOP = "Kirlin and Sons";
    private static final String OTHER = "Heller, Gutmann and Zieme";

    private TopologyTestDriver driver;
    private TestInputTopic<String, ControlEvent> control;
    private TestInputTopic<String, Transaction> transactions;
    private TestOutputTopic<String, Decision> decisions;
    private TestOutputTopic<String, Alert> alerts;
    private int seq;

    @BeforeEach
    void setUp() {
        Config cfg = new Config("dummy:9092", "fraud-detector-test", "at_least_once", 100, 0,
                System.getProperty("java.io.tmpdir") + "/fraud-detector-test-" + System.nanoTime(),
                "transactions", "decisions", "alerts", "cases", "control", 1000);
        driver = new TopologyTestDriver(FraudTopology.build(cfg), cfg.toStreamsProperties());
        StringSerializer keyOut = new StringSerializer();
        StringDeserializer keyIn = new StringDeserializer();
        control = driver.createInputTopic("control", keyOut, JsonSerde.of(ControlEvent.class).serializer());
        transactions = driver.createInputTopic("transactions", keyOut, JsonSerde.of(Transaction.class).serializer());
        decisions = driver.createOutputTopic("decisions", keyIn, JsonSerde.of(Decision.class).deserializer());
        alerts = driver.createOutputTopic("alerts", keyIn, JsonSerde.of(Alert.class).deserializer());
    }

    @AfterEach
    void tearDown() {
        driver.close();
    }

    @Test
    void blockedMerchantIsDeclinedUnderR6() {
        control.pipeInput(CARD, merchantRule(SHOP, "BLOCK"));

        Decision blocked = pay(SHOP, 71_500, "2026-11-01T10:00:00+07:00");
        assertEquals(Verdict.DECLINE, blocked.decision());
        assertEquals(List.of("R6"), blocked.firedRules());
        assertEquals(1.0, blocked.score());
        assertEquals("R6", alerts.readValue().ruleId());

        assertEquals(Verdict.ALLOW, pay(OTHER, 71_500, "2026-11-01T10:01:00+07:00").decision());
    }

    @Test
    void blockMatchesTheMerchantIgnoringCase() {
        control.pipeInput(CARD, merchantRule("kirlin AND sons ", "BLOCK"));
        assertEquals(Verdict.DECLINE, pay(SHOP, 71_500, "2026-11-01T10:00:00+07:00").decision());
    }

    @Test
    void releasingTheMerchantLiftsTheBlock() {
        control.pipeInput(CARD, merchantRule(SHOP, "BLOCK"));
        control.pipeInput(CARD, new ControlEvent("RELEASE_MERCHANT", "merchant:" + SHOP, null, null, null, null, null));

        Decision d = pay(SHOP, 71_500, "2026-11-01T10:00:00+07:00");
        assertEquals(Verdict.ALLOW, d.decision());
        assertTrue(d.firedRules().isEmpty());
    }

    @Test
    void allowingAMerchantReplacesItsBlock() {
        control.pipeInput(CARD, merchantRule(SHOP, "BLOCK"));
        control.pipeInput(CARD, merchantRule(SHOP, "ALLOW"));

        Decision d = pay(SHOP, 71_500, "2026-11-01T10:00:00+07:00");
        assertEquals(Verdict.ALLOW, d.decision());
        assertTrue(d.firedRules().isEmpty());
    }

    @Test
    void goingOverTheBudgetRaisesAnAlertButIsAllowed() {
        control.pipeInput(CARD, budget(1_000_000, "MONTH"));

        Decision first = pay(SHOP, 600_000, "2026-11-01T10:00:00+07:00");
        assertTrue(first.firedRules().isEmpty());
        assertTrue(alerts.isEmpty());

        Decision over = pay(OTHER, 500_000, "2026-11-15T10:00:00+07:00");
        assertEquals(Verdict.ALLOW, over.decision());
        assertEquals(List.of("BUDGET"), over.firedRules());
        assertEquals(0.0, over.score());
        assertEquals("BUDGET", alerts.readValue().ruleId());

        // A new month starts from zero.
        assertTrue(pay(SHOP, 500_000, "2026-12-01T00:30:00+07:00").firedRules().isEmpty());
    }

    @Test
    void spendBeforeTheBudgetWasSetCounts() {
        pay(SHOP, 900_000, "2026-11-01T10:00:00+07:00");
        control.pipeInput(CARD, budget(1_000_000, "DAY"));

        assertEquals(List.of("BUDGET"), pay(OTHER, 200_000, "2026-11-01T11:00:00+07:00").firedRules());
        assertTrue(pay(OTHER, 200_000, "2026-11-02T09:00:00+07:00").firedRules().isEmpty());
    }

    @Test
    void aDeclinedPaymentSpendsNothing() {
        control.pipeInput(CARD, budget(1_000_000, "WEEK"));
        control.pipeInput(CARD, merchantRule(SHOP, "BLOCK"));

        Decision declined = pay(SHOP, 900_000, "2026-11-02T10:00:00+07:00");
        assertEquals(List.of("R6"), declined.firedRules());
        assertTrue(pay(OTHER, 500_000, "2026-11-03T10:00:00+07:00").firedRules().isEmpty());
    }

    @Test
    void aFrozenCardIsStillDeclinedFirst() {
        control.pipeInput(CARD, merchantRule(SHOP, "ALLOW"));
        control.pipeInput(CARD, new ControlEvent("FREEZE_CARD", "freeze", "FREEZE", null, null, null, null));

        Decision d = pay(SHOP, 71_500, "2026-11-01T10:00:00+07:00");
        assertEquals(Verdict.DECLINE, d.decision());
        assertEquals(List.of("FROZEN"), d.firedRules());
    }

    private Decision pay(String merchant, long amount, String at) {
        Instant ts = Instant.from(java.time.OffsetDateTime.parse(at));
        transactions.pipeInput(CARD, new Transaction("txn-" + (++seq), ts.toString(), ts.getEpochSecond(), CARD,
                Transaction.CARD, merchant, null, "grocery_pos", amount, "VND", 10.0, 106.0));
        return decisions.readValue();
    }

    private static ControlEvent merchantRule(String merchant, String rule) {
        return new ControlEvent("SET_MERCHANT_RULE", "merchant:" + merchant, "MERCHANT", merchant, rule, null, null);
    }

    private static ControlEvent budget(long limit, String period) {
        return new ControlEvent("SET_BUDGET", "budget", "BUDGET", null, null, limit, period);
    }
}
