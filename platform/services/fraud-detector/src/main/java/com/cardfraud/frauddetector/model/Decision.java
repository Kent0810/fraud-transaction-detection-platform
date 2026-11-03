package com.cardfraud.frauddetector.model;

import java.util.List;

// Exactly one per transaction. Carries the transaction's fields too, so the Cassandra sink
// can fill txn_by_card from this topic alone.
public record Decision(
        String txnId,
        String cardId,
        String ts,
        String channel,
        String merchant,
        String recipientAccount,
        String category,
        long amount,
        String currency,
        Double merchLat,
        Double merchLong,
        Verdict decision,
        double score,
        List<String> firedRules,
        String decidedAt) {

    public enum Verdict { ALLOW, STEP_UP, DECLINE }

    // The recipient is on this card's blacklist: the cardholder asked for that, so there is nothing for an analyst to judge.
    public static final String BLOCKED_RECIPIENT = "R6";
    // The recipient carries a bank-wide fraud mark: the money still moves, and an analyst looks at the sender.
    public static final String FRAUD_RECIPIENT = "FRAUD_RECIPIENT";

    // The fired rules an analyst sees as alerts.
    public List<String> alertRules() {
        return firedRules.stream().filter(rule -> !BLOCKED_RECIPIENT.equals(rule)).toList();
    }

    // Whether this decision goes on the card's case, and so into the triage queue.
    public boolean needsReview() {
        if (firedRules.contains(FRAUD_RECIPIENT)) {
            return true;
        }
        return decision != Verdict.ALLOW && !alertRules().isEmpty();
    }
}
