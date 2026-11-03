package com.cardfraud.frauddetector.model;

import java.util.List;

public record Alert(
        String alertId,     // txn_id:rule_id, so a replay overwrites the same Cassandra row
        String cardId,
        String txnId,
        String ruleId,
        double score,
        long amount,
        String ts) {

    // One alert per fired rule an analyst should see; none when nothing fired.
    public static List<Alert> fromDecision(Decision d) {
        return d.alertRules().stream()
                .map(rule -> new Alert(
                        d.txnId() + ":" + rule,
                        d.cardId(),
                        d.txnId(),
                        rule,
                        d.score(),
                        d.amount(),
                        d.ts()))
                .toList();
    }
}
