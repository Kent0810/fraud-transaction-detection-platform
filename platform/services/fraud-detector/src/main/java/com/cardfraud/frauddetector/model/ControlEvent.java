package com.cardfraud.frauddetector.model;

// One change to a card's controls, from the outbox (controls.types.ts in the cardholder backend).
public record ControlEvent(
        String action,
        String controlId,      // "budget", "freeze" or "merchant:<name>"
        String kind,
        String merchant,       // null on RELEASE_MERCHANT: the name is in controlId
        String rule,           // BLOCK or ALLOW
        Long budgetLimit,      // VND
        String budgetPeriod) { // DAY, WEEK or MONTH

    public static final String FREEZE = "FREEZE_CARD";
    public static final String UNFREEZE = "UNFREEZE_CARD";
    public static final String SET_MERCHANT_RULE = "SET_MERCHANT_RULE";
    public static final String RELEASE_MERCHANT = "RELEASE_MERCHANT";
    public static final String SET_BUDGET = "SET_BUDGET";

    private static final String MERCHANT_PREFIX = "merchant:";

    public boolean isFreezeChange() {
        return FREEZE.equals(action) || UNFREEZE.equals(action);
    }

    public boolean freezes() {
        return FREEZE.equals(action);
    }

    // The merchant a SET_MERCHANT_RULE or RELEASE_MERCHANT is about.
    public String merchantName() {
        if (controlId != null && controlId.startsWith(MERCHANT_PREFIX)) {
            return controlId.substring(MERCHANT_PREFIX.length());
        }
        return merchant;
    }
}
