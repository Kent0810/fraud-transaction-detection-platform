package com.cardfraud.frauddetector.model;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

// Latest summary per card, updated on every decision that is not ALLOW.
public record CaseSummary(
        String cardId,
        double riskScore,
        double priority,    // score x amount, ranks the analyst queue
        long amountSum,
        int openAlerts,
        Decision.Verdict lastDecision,
        String bucket,      // UTC day, e.g. 2026-10-20; partition of triage_queue
        String updatedAt) {

    // The starting value before a card's first flagged decision (the aggregate's initializer).
    public static final CaseSummary EMPTY = new CaseSummary(null, 0, 0, 0, 0, null, null, null);

    public CaseSummary update(String cardId, Decision d) {
        return new CaseSummary(
                cardId,
                Math.max(riskScore, d.score()),
                Math.max(priority, d.score() * d.amount()),
                amountSum + d.amount(),
                openAlerts + d.firedRules().size(),
                d.decision(),
                LocalDate.now(ZoneOffset.UTC).toString(),
                Instant.now().toString());
    }
}
