package com.cardfraud.frauddetector.rules;

import java.util.ArrayList;
import java.util.List;

// A card's transfers the detector allowed, as (epoch second, amount): what AMOUNT_SPIKE calls the card's normal.
public record TransferHistory(List<Entry> entries) {
    public record Entry(long at, long amount) {
    }

    public static final long WINDOW_SECONDS = 30 * 86_400L;

    public static final TransferHistory NONE = new TransferHistory(List.of());

    // Only the entries from the 30 days up to `now`, inclusive.
    public TransferHistory within(long now) {
        long from = now - WINDOW_SECONDS;
        return new TransferHistory(entries.stream().filter(e -> e.at() >= from).toList());
    }

    public TransferHistory add(long at, long amount) {
        List<Entry> next = new ArrayList<>(entries);
        next.add(new Entry(at, amount));
        return new TransferHistory(next);
    }

    public int count() {
        return entries.size();
    }

    public long sum() {
        return entries.stream().mapToLong(e -> e.amount()).sum();
    }
}
