package com.cardfraud.frauddetector.rules;

import java.util.ArrayList;
import java.util.List;

public record PaymentHistory(List<Day> days) {
    public record Day(long start, long count, long sum) {
    }

    public static final long WINDOW_SECONDS = 30 * 86_400L;

    public static final PaymentHistory NONE = new PaymentHistory(List.of());

    // Only the days that start in the 30 days up to `now`, inclusive.
    public PaymentHistory within(long now) {
        long from = Budget.periodStart(Budget.DAY, now - WINDOW_SECONDS);
        return new PaymentHistory(days.stream().filter(d -> d.start() >= from).toList());
    }

    public PaymentHistory add(long at, long amount) {
        long start = Budget.periodStart(Budget.DAY, at);
        List<Day> next = new ArrayList<>(days);
        for (int i = 0; i < next.size(); i++) {
            Day d = next.get(i);
            if (d.start() == start) {
                next.set(i, new Day(start, d.count() + 1, d.sum() + amount));
                return new PaymentHistory(next);
            }
        }
        next.add(new Day(start, 1, amount));
        return new PaymentHistory(next);
    }

    public long count() {
        return days.stream().mapToLong(d -> d.count()).sum();
    }

    public long sum() {
        return days.stream().mapToLong(d -> d.sum()).sum();
    }
}
