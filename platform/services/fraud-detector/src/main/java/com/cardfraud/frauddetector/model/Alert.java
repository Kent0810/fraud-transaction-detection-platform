package com.cardfraud.frauddetector.model;

import java.util.List;

public record Alert(
        String alertId,     // txn_id:rule_id, so a replay overwrites the same Cassandra row
        String cardId,
        String txnId,
        String ruleId,
        double score,
        double amount,
        String ts) {

    public static List<Alert> fromDecision(Decision d) {
        // TODO one Alert per entry in d.firedRules(); an empty list when nothing fired.
        throw new UnsupportedOperationException("TODO Alert.fromDecision");
    }
}
