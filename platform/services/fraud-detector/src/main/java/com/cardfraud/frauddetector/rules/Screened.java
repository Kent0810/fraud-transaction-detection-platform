package com.cardfraud.frauddetector.rules;

import com.cardfraud.frauddetector.model.Transaction;

public record Screened(Transaction txn, boolean frozen, boolean fraudMarked, BlockedRecipients blockedRecipients, Budget budget) {
    public static Screened of(Transaction txn, boolean frozen) {
        return new Screened(txn, frozen, false, null, null);
    }

    public Screened withFraudMark(boolean marked) {
        return new Screened(txn, frozen, marked, blockedRecipients, budget);
    }

    public Screened withBlockedRecipients(BlockedRecipients blocked) {
        return new Screened(txn, frozen, fraudMarked, blocked, budget);
    }

    public Screened withBudget(Budget cardBudget) {
        return new Screened(txn, frozen, fraudMarked, blockedRecipients, cardBudget);
    }
}
