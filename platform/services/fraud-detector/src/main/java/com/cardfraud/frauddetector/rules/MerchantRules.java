package com.cardfraud.frauddetector.rules;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

// A card's merchant rules (BR2, BR3): merchant -> BLOCK or ALLOW, latest change wins.
// Names are matched ignoring case and surrounding spaces.
public record MerchantRules(Map<String, String> byMerchant) {
    public static final String BLOCK = "BLOCK";
    public static final String ALLOW = "ALLOW";

    public static final MerchantRules NONE = new MerchantRules(Map.of());

    // BLOCK, ALLOW, or null when the card has no rule for this merchant.
    public String ruleFor(String merchant) {
        return merchant == null ? null : byMerchant.get(key(merchant));
    }

    public MerchantRules set(String merchant, String rule) {
        Map<String, String> next = new HashMap<>(byMerchant);
        next.put(key(merchant), rule);
        return new MerchantRules(next);
    }

    public MerchantRules release(String merchant) {
        Map<String, String> next = new HashMap<>(byMerchant);
        next.remove(key(merchant));
        return new MerchantRules(next);
    }

    private static String key(String merchant) {
        return merchant.trim().toLowerCase(Locale.ROOT);
    }
}
