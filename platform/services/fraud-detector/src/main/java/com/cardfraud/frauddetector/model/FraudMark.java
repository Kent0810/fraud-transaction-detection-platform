package com.cardfraud.frauddetector.model;

// A recipient an agent confirmed as fraud, bank-wide. Keyed by recipient id; active = false when an analyst removes it.
public record FraudMark(String recipientId, boolean active) {
}
