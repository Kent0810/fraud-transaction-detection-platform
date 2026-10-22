package com.cardfraud.frauddetector.model;

public record Transaction(
        String txnId,
        String ts,
        double tsEpoch,
        String ccNum,
        String merchant,
        String category,
        double amt,
        double merchLat,
        double merchLong) {
}
