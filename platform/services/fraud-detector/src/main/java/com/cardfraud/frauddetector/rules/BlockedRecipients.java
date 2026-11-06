package com.cardfraud.frauddetector.rules;

import java.util.HashSet;
import java.util.Set;

// The recipients one card has blocked. A BLOCK adds one; an ALLOW or a release removes it (latest change wins).
public record BlockedRecipients(Set<String> recipientIds) {
    // The rule values a SET_RECIPIENT_RULE control event carries.
    public static final String BLOCK = "BLOCK";
    public static final String ALLOW = "ALLOW";

    public static final BlockedRecipients NONE = new BlockedRecipients(Set.of());

    public boolean isBlocked(String recipientId) {
        return recipientIds.contains(recipientId);
    }

    public BlockedRecipients block(String recipientId) {
        Set<String> next = new HashSet<>(recipientIds);
        next.add(recipientId);
        return new BlockedRecipients(next);
    }

    public BlockedRecipients unblock(String recipientId) {
        Set<String> next = new HashSet<>(recipientIds);
        next.remove(recipientId);
        return new BlockedRecipients(next);
    }
}
