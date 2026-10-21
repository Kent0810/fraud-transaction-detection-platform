package cardfraud;

import java.util.List;

// One per fired rule.
record Alert(
        String alertId,     // txn_id:rule_id, so a replay overwrites the same Cassandra row
        String cardId,
        String txnId,
        String ruleId,
        double score,
        double amount,
        String ts) {

    static List<Alert> fromDecision(Decision d) {
        // TODO one Alert per entry in d.firedRules(); an empty list when nothing fired.
        throw new UnsupportedOperationException("TODO Alert.fromDecision");
    }
}
