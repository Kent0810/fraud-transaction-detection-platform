package com.cardfraud.frauddetector.rules;

import java.util.HashMap;
import java.util.Map;

// A card's recipient rules: recipient id -> BLOCK (blacklist) or ALLOW (whitelist), latest change wins.
public record RecipientRules(Map<String, String> byRecipient) {
    public static final String BLOCK = "BLOCK";
    public static final String ALLOW = "ALLOW";

    public static final RecipientRules NONE = new RecipientRules(Map.of());

    // BLOCK, ALLOW, or null when the card has no rule for this recipient.
    public String ruleFor(String recipientId) {
        return byRecipient.get(recipientId);
    }

    public RecipientRules set(String recipientId, String rule) {
        Map<String, String> next = new HashMap<>(byRecipient);
        next.put(recipientId, rule);
        return new RecipientRules(next);
    }

    public RecipientRules release(String recipientId) {
        Map<String, String> next = new HashMap<>(byRecipient);
        next.remove(recipientId);
        return new RecipientRules(next);
    }
}
