package com.cardfraud.frauddetector.model;

import java.util.List;

public record TransferDecision(
        String txnId,
        String cardId,
        long amt,
        String currency,
        Verdict decision,
        List<String> firedRules,
        String decidedAt) {

    public enum Verdict { APPROVE, DECLINE }
}
