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
    public static final String FROZEN = "R1";
    // The recipient is on this card's blacklist: the cardholder asked for that, so there is nothing for an analyst to judge.
    public static final String BLOCKED_RECIPIENT = "R2";
    // The recipient carries a bank-wide fraud mark: a transfer is held for an agent, a card payment is declined.
    public static final String FRAUD_RECIPIENT = "R3";
    // A payment or transfer of at least SPIKE_FLOOR and SPIKE_FACTOR times the card's average of the last 30 days:
    // a transfer is held for an agent, a card payment is declined.
    public static final String AMOUNT_SPIKE = "R4";
    // Card payments only: one alone only alerts, both decline.
    public static final String VELOCITY = "R5";
    public static final String IMPOSSIBLE_TRAVEL = "R6";
    // Over the cardholder's budget: alert only, never changes the verdict.
    public static final String BUDGET = "R7";

    public static final Map<String, Double> WEIGHTS = Map.of(
            BLOCKED_RECIPIENT, 1.0,
            FRAUD_RECIPIENT, 0.5,
            AMOUNT_SPIKE, 0.5,
            VELOCITY, 0.3,
            IMPOSSIBLE_TRAVEL, 0.3);

    public static final long SPIKE_FACTOR = 20;
    // VND. A smaller transfer is never a spike, however small the card's usual payments.
    public static final long SPIKE_FLOOR = 10_000_000;
    // Fewer past payments and transfers than this and the card has no normal yet: AMOUNT_SPIKE is skipped.
    public static final int SPIKE_MIN_HISTORY = 3;

    public static final int VELOCITY_COUNT = 5;
    public static final double TRAVEL_MIN_KM = 50;
    public static final double TRAVEL_MAX_KMH = 800;

    public static final double DECLINE_AT = 0.9;
    public static final double STEP_UP_AT = 0.4;

    private Rules() {
    }

    public static Decision evaluate(String cardId, Screened s, long spentInPeriod, PaymentHistory history,
                                    CardActivity activity, long simAt) {
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
        if (txn.amt() >= SPIKE_FLOOR
                && history.count() >= SPIKE_MIN_HISTORY
                && txn.amt() * history.count() >= SPIKE_FACTOR * history.sum()) {
            fired.add(AMOUNT_SPIKE);
        }

        if (Transaction.CARD.equals(txn.channel())) {
            fired.addAll(cardRules(txn, activity, simAt));
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

    private static List<String> cardRules(Transaction txn, CardActivity activity, long simAt) {
        List<String> fired = new ArrayList<>();
        int recent = activity.paymentsWithinHour(simAt);
        if (recent + 1 >= VELOCITY_COUNT) {
            fired.add(VELOCITY);
        }

        Double lat = txn.merchLat();
        Double lng = txn.merchLong();
        CardActivity.Place last = activity.lastInPerson();
        if (isInPerson(txn) && last != null && lat != null && lng != null) {
            double km = Geo.km(last.lat(), last.lng(), lat, lng);
            double hours = Math.max(simAt - last.at(), 60) / 3600.0;
            if (km > TRAVEL_MIN_KM && km / hours > TRAVEL_MAX_KMH) {
                fired.add(IMPOSSIBLE_TRAVEL);
            }
        }
        return fired;
    }

    // Dataset categories end in _pos (in person) or _net (online).
    public static boolean isInPerson(Transaction txn) {
        return txn.category() != null && txn.category().endsWith("_pos");
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
