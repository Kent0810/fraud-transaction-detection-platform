package cardfraud;

// Latest summary per card, updated on every decision that is not ALLOW.
record CaseSummary(
        String cardId,
        double riskScore,
        double priority,    // score x amount, ranks the analyst queue
        double amountSum,
        int openAlerts,
        Decision.Verdict lastDecision,
        String bucket,      // UTC day, e.g. 2026-10-20; partition of triage_queue
        String updatedAt) {

    // The starting value before a card's first flagged decision (the aggregate's initializer).
    static final CaseSummary EMPTY = new CaseSummary(null, 0, 0, 0, 0, null, null, null);

    CaseSummary update(String cardId, Decision d) {
        // TODO return a NEW CaseSummary (records are immutable):
        //   riskScore / priority: keep the highest seen; amountSum / openAlerts: add this decision's;
        //   lastDecision: this one; bucket: today's UTC date; updatedAt: now.
        throw new UnsupportedOperationException("TODO CaseSummary.update");
    }
}
