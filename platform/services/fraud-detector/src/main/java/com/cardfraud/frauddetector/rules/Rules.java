package com.cardfraud.frauddetector.rules;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.cardfraud.frauddetector.model.Decision;
import com.cardfraud.frauddetector.model.Decision.Verdict;
import com.cardfraud.frauddetector.model.Transaction;

public final class Rules {
    public static final Map<String, Double> WEIGHTS = Map.of(
            "R1", 0.5,   // velocity
            "R2", 0.5,   // amount spike
            "R3", 0.6,   // impossible travel
            "R4", 0.4,   // new-region burst
            "R5", 0.3,   // high-risk category
            "R6", 1.0);  // blocked merchant

    public static final double DECLINE_AT = 0.8;
    public static final double STEP_UP_AT = 0.4;

    private Rules() {
    }

    public static Decision evaluate(String cardId, Transaction txn) {
        // TODO
        //   1. Collect the ids of the rules that fire ("R1", "R5", ...) in a List<String>.
        //      Start with none: every transaction ALLOW. Add rules one at a time later;
        //      most need per-card history, so they will read state stores, not just txn.
        //   2. score = sum of WEIGHTS for the fired rules, capped at 1.0.
        //   3. Build the Decision: copy the transaction's fields, add verdict(score),
        //      score, fired rules and decidedAt = Instant.now().toString().

        // 1. Rules that fired. None yet: add them here, e.g. `if (...) fired.add("R5");`
        List<String> fired = new ArrayList<>();

        // 2. Sum of their weights, capped at 1.0 (0 when nothing fired)
        double score = 1.0; // Math.min(1.0, fired.stream().mapToDouble(WEIGHTS::get).sum());

        // 3. The decision
        return new Decision(
            txn.txnId(),
            cardId,
            txn.ts(),
            txn.channel(),
            txn.merchant(),
            txn.counterpartyAccount(),
            txn.category(),
            txn.amt(),
            txn.currency(),
            txn.merchLat(),
            txn.merchLong(),
            verdict(score),
            score,
            fired,
            Instant.now().toString());
    }

    public static Decision frozen(String cardId, Transaction txn) {
        return new Decision(
            txn.txnId(),
            cardId,
            txn.ts(),
            txn.channel(),
            txn.merchant(),
            txn.counterpartyAccount(),
            txn.category(),
            txn.amt(),
            txn.currency(),
            txn.merchLat(),
            txn.merchLong(),
            Verdict.DECLINE,
            1.0,
            List.of("FROZEN"),
            Instant.now().toString());
    }

    public static Verdict verdict(double score) {
        // if (score >= DECLINE_AT) {
        //     return Verdict.DECLINE;
        // }
        // if (score >= STEP_UP_AT) {
        //     return Verdict.STEP_UP;
        // }
        return Verdict.ALLOW;
    }
}
