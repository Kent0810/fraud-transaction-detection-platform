package com.cardfraud.frauddetector.rules;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.cardfraud.frauddetector.model.Decision;
import com.cardfraud.frauddetector.model.Decision.Verdict;
import com.cardfraud.frauddetector.model.Transaction;

// Every fraud rule: its name, its weight, when it fires, and what follows from it (alerts, analyst review).
public final class Rules {
    // The cardholder froze the card: every payment is declined, and no other rule runs.
    public static final String FROZEN = "FROZEN";
    // The recipient is on this card's blacklist: the cardholder asked for that, so there is nothing for an analyst to judge.
    public static final String BLOCKED_RECIPIENT = "BLOCKED_RECIPIENT";
    // The recipient carries a bank-wide fraud mark: a transfer is held for an agent, a card payment is declined.
    public static final String FRAUD_RECIPIENT = "FRAUD_RECIPIENT";
    // A transfer at least SPIKE_FACTOR times the card's average transfer of the last 30 days: held for an agent.
    public static final String AMOUNT_SPIKE = "AMOUNT_SPIKE";
    // Over the cardholder's budget: alert only, never changes the verdict.
    public static final String BUDGET = "BUDGET";

    public static final Map<String, Double> WEIGHTS = Map.of(
            "R1", 0.5,   // velocity
            "R3", 0.6,   // impossible travel
            "R4", 0.4,   // new-region burst
            "R5", 0.3,   // high-risk category
            BLOCKED_RECIPIENT, 1.0,
            // Between STEP_UP_AT and DECLINE_AT: on its own the transfer is held, not declined.
            AMOUNT_SPIKE, 0.5,
            // Between STEP_UP_AT and DECLINE_AT: on its own, a transfer is held and a card payment declined.
            FRAUD_RECIPIENT, 0.5);

    public static final long SPIKE_FACTOR = 20;
    // Fewer past transfers than this and the card has no normal yet: AMOUNT_SPIKE is skipped.
    public static final int SPIKE_MIN_HISTORY = 3;

    public static final double DECLINE_AT = 0.8;
    public static final double STEP_UP_AT = 0.4;

    private Rules() {
    }

    /**
     * @param s             the transaction and everything the joins found about it
     * @param spentInPeriod spent so far in the budget's current period, before this transaction (0 with no budget)
     * @param history       the card's allowed transfers of the last 30 days, before this transaction
     */
    public static Decision evaluate(String cardId, Screened s, long spentInPeriod, TransferHistory history) {
        Transaction txn = s.txn();
        if (s.frozen()) {
            return decision(cardId, txn, Verdict.DECLINE, 1.0, List.of(FROZEN));
        }

        boolean blocked = s.blockedRecipients() != null && s.blockedRecipients().isBlocked(RecipientId.of(txn));
        boolean fraudMarked = s.fraudMarked();
        Budget budget = s.budget();
        List<String> fired = new ArrayList<>();

        if (blocked) {
            fired.add(BLOCKED_RECIPIENT);
        } else if (fraudMarked) {
            // Not when blacklisted: that payment fails anyway, so no money reaches the recipient to review.
            fired.add(FRAUD_RECIPIENT);
        }

        // amount >= 20 x average, without division: amount x count >= 20 x sum.
        if (Transaction.TRANSFER.equals(txn.channel())
                && history.count() >= SPIKE_MIN_HISTORY
                && txn.amt() * history.count() >= SPIKE_FACTOR * history.sum()) {
            fired.add(AMOUNT_SPIKE);
        }

        // Sum of the fired rules' weights, capped at 1.0 (0 when nothing fired).
        double score = Math.min(1.0, fired.stream().mapToDouble(r -> WEIGHTS.getOrDefault(r, 0.0)).sum());
        Verdict verdict = verdict(score);

        // BR5: flag the payment that takes the card over its budget. A declined one spends nothing.
        if (verdict != Verdict.DECLINE && budget != null && spentInPeriod + txn.amt() > budget.limit()) {
            fired.add(BUDGET);
        }

        return decision(cardId, txn, verdict, score, fired);
    }

    // The fired rules an analyst sees as alerts.
    public static List<String> alertRules(Decision d) {
        return d.firedRules().stream().filter(rule -> !BLOCKED_RECIPIENT.equals(rule)).toList();
    }

    // Whether this decision goes on the card's case, and so into the triage queue.
    public static boolean needsReview(Decision d) {
        if (d.firedRules().contains(FRAUD_RECIPIENT)) {
            return true;
        }
        return d.decision() != Verdict.ALLOW && !alertRules(d).isEmpty();
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
