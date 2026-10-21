package cardfraud;

import java.util.Map;

import cardfraud.Decision.Verdict;

final class Rules {
    static final Map<String, Double> WEIGHTS = Map.of(
            "R1", 0.5,   // velocity
            "R2", 0.5,   // amount spike
            "R3", 0.6,   // impossible travel
            "R4", 0.4,   // new-region burst
            "R5", 0.3,   // high-risk category
            "R6", 1.0);  // blocked merchant

    static final double DECLINE_AT = 0.8;
    static final double STEP_UP_AT = 0.4;

    private Rules() {
    }

    static Decision evaluate(String cardId, Transaction txn) {
        // TODO
        //   1. Collect the ids of the rules that fire ("R1", "R5", ...) in a List<String>.
        //      Start with none: every transaction ALLOW. Add rules one at a time later;
        //      most need per-card history, so they will read state stores, not just txn.
        //   2. score = sum of WEIGHTS for the fired rules, capped at 1.0.
        //   3. Build the Decision: copy the transaction's fields, add verdict(score),
        //      score, fired rules and decidedAt = Instant.now().toString().
        throw new UnsupportedOperationException("TODO Rules.evaluate");
    }

    static Verdict verdict(double score) {
        // TODO >= DECLINE_AT -> DECLINE, >= STEP_UP_AT -> STEP_UP, otherwise ALLOW
        throw new UnsupportedOperationException("TODO Rules.verdict");
    }
}
