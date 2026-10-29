package com.cardfraud.frauddetector.rules;

import java.util.ArrayList;
import java.util.List;

import com.cardfraud.frauddetector.model.Decision;
import com.cardfraud.frauddetector.model.TransferDecision;
import com.cardfraud.frauddetector.model.TransferDecision.Verdict;

public final class TransferRules {
    // VND
    public static final long LARGE_AMOUNT = 50_000_000;

    private TransferRules() {
    }

    public static TransferDecision decide(Decision card) {
        List<String> fired = new ArrayList<>(card.firedRules());
        if (card.amount() >= LARGE_AMOUNT) {
            fired.add("LARGE_AMOUNT");
        }
        boolean approve = card.decision() == Decision.Verdict.ALLOW && fired.isEmpty();
        if (!approve && fired.isEmpty()) {
            fired.add(card.decision().name());
        }

        return new TransferDecision(
            card.txnId(),
            card.cardId(),
            card.amount(),
            card.currency(),
            approve ? Verdict.APPROVE : Verdict.DECLINE,
            fired,
            card.decidedAt());
    }
}
