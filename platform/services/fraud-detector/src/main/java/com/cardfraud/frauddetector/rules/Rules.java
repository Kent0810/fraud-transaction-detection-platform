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
            Decision.BLOCKED_RECIPIENT, 1.0,
            // Below STEP_UP_AT: a fraud mark alone flags the payment and never stops it. Above 0: it ranks in the queue.
            Decision.FRAUD_RECIPIENT, 0.3);

    public static final String BLOCKED_RECIPIENT = Decision.BLOCKED_RECIPIENT;
    public static final String FRAUD_RECIPIENT = Decision.FRAUD_RECIPIENT;
    public static final String LARGE_AMOUNT_RULE = "LARGE_AMOUNT";
    // Over the cardholder's budget: alert only, never changes the verdict.
    public static final String BUDGET = "BUDGET";

    // A transfer of at least this much (VND) is declined outright
    public static final long LARGE_AMOUNT = 50_000_000L;

    public static final double DECLINE_AT = 0.8;
    public static final double STEP_UP_AT = 0.4;

    private Rules() {
    }

    /**
     * @param recipientRule  the card's rule for this recipient: BLOCK, ALLOW or null
     * @param fraudMarked   whether this recipient carries a bank-wide fraud mark
     * @param budget        the card's budget, or null when it has none
     * @param spentInPeriod spent so far in the budget's current period, before this transaction
     */
    public static Decision evaluate(String cardId, Transaction txn, String recipientRule, boolean fraudMarked,
                                    Budget budget, long spentInPeriod) {
        List<String> fired = new ArrayList<>();

        boolean allowListed = RecipientRules.ALLOW.equals(recipientRule);
        if (!allowListed) {
            // R1 to R5 go here. A recipient the card whitelists skips them (BR3). None are written yet.
        }

        if (RecipientRules.BLOCK.equals(recipientRule)) {
            fired.add(BLOCKED_RECIPIENT);
        } else if (fraudMarked) {
            // Not when blacklisted: that payment fails anyway, so no money reaches the recipient to review.
            fired.add(FRAUD_RECIPIENT);
        }

        if (Transaction.TRANSFER.equals(txn.channel()) && txn.amt() >= LARGE_AMOUNT) {
            fired.add(LARGE_AMOUNT_RULE);
        }

        // Sum of the fired rules' weights, capped at 1.0 (0 when nothing fired).
        double score = Math.min(1.0, fired.stream().mapToDouble(r -> WEIGHTS.getOrDefault(r, 0.0)).sum());
        Verdict verdict = fired.contains(LARGE_AMOUNT_RULE) ? Verdict.DECLINE : verdict(score);

        // BR5: flag the payment that takes the card over its budget. A declined one spends nothing.
        if (verdict != Verdict.DECLINE && budget != null && spentInPeriod + txn.amt() > budget.limit()) {
            fired.add(BUDGET);
        }

        return decision(cardId, txn, verdict, score, fired);
    }

    public static Decision frozen(String cardId, Transaction txn) {
        return decision(cardId, txn, Verdict.DECLINE, 1.0, List.of("FROZEN"));
    }

    public static Verdict verdict(double score) {
        if (score >= DECLINE_AT) {
            return Verdict.DECLINE;
        }
        if (score >= STEP_UP_AT) {
            return Verdict.STEP_UP;
        }
        return Verdict.ALLOW;
    }

    private static Decision decision(String cardId, Transaction txn, Verdict verdict, double score,
                                     List<String> fired) {
        return new Decision(
            txn.txnId(),
            cardId,
            txn.ts(),
            txn.channel(),
            txn.merchant(),
            txn.recipientAccount(),
            txn.category(),
            txn.amt(),
            txn.currency(),
            txn.merchLat(),
            txn.merchLong(),
            verdict,
            score,
            fired,
            Instant.now().toString());
    }
}
