package cardfraud;

// One record from the transactions topic, as event-source writes it.
record Transaction(
        String txnId,
        String ts,          // ISO-8601 event time
        double tsEpoch,     // the same moment, seconds
        String ccNum,       // also the message key
        String merchant,
        String category,
        double amt,
        double merchLat,
        double merchLong) {
}
