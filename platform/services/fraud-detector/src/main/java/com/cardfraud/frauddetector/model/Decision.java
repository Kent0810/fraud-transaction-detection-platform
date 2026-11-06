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
}
