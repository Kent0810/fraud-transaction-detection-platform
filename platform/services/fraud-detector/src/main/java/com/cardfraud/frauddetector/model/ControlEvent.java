package com.cardfraud.frauddetector.model;

// One change to a card's controls, from the outbox (controls.types.ts in the cardholder backend).
public record ControlEvent(
        String action,
        String controlId,      // "budget", "freeze" or "recipient:<recipient id>"
        String kind,
        String rule,           // BLOCK or ALLOW
        Long budgetLimit,      // VND
        String budgetPeriod) { // DAY, WEEK or MONTH

    public static final String FREEZE = "FREEZE_CARD";
    public static final String UNFREEZE = "UNFREEZE_CARD";
    public static final String SET_RECIPIENT_RULE = "SET_RECIPIENT_RULE";
    public static final String RELEASE_RECIPIENT = "RELEASE_RECIPIENT";
    public static final String SET_BUDGET = "SET_BUDGET";

    private static final String RECIPIENT_PREFIX = "recipient:";

    public boolean isFreezeChange() {
        return FREEZE.equals(action) || UNFREEZE.equals(action);
    }

    public boolean freezes() {
        return FREEZE.equals(action);
    }

    // The recipient a SET_RECIPIENT_RULE or RELEASE_RECIPIENT is about, or null when the control id names none.
    public String recipientId() {
        return controlId != null && controlId.startsWith(RECIPIENT_PREFIX)
                ? controlId.substring(RECIPIENT_PREFIX.length())
                : null;
    }
}
