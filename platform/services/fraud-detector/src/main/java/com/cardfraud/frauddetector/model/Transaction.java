package com.cardfraud.frauddetector.model;

public record Transaction(
        String txnId,
        String ts,
        double tsEpoch,
        String ccNum,
        String channel,
        String merchant,
        String counterpartyAccount,
        String category,
        long amt,
        String currency,
        Double merchLat,
        Double merchLong) {

    public static final String CARD = "CARD";
    public static final String TRANSFER = "TRANSFER";
}
