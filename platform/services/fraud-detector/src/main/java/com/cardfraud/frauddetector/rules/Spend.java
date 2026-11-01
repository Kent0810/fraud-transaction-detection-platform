package com.cardfraud.frauddetector.rules;

// What a card has spent so far in the current day, week and month (BR5): every payment and transfer that was not
// declined. Kept for all three periods, so a budget set or changed mid-period starts from the real spend.
public record Spend(Bucket day, Bucket week, Bucket month) {

    // Total spent in the period that starts at `start` (epoch second).
    public record Bucket(long start, long total) {
        static final Bucket NONE = new Bucket(Long.MIN_VALUE, 0);

        long in(long periodStart) {
            return periodStart == start ? total : 0;
        }

        // A late transaction from an earlier period leaves the current one alone.
        Bucket add(long periodStart, long amount) {
            if (periodStart == start) return new Bucket(start, total + amount);
            if (periodStart > start) return new Bucket(periodStart, amount);
            return this;
        }
    }

    public static final Spend NONE = new Spend(Bucket.NONE, Bucket.NONE, Bucket.NONE);

    // Spent so far in the `period` (DAY, WEEK, MONTH) holding `at` (epoch second).
    public long in(String period, long at) {
        long start = Budget.periodStart(period, at);
        return switch (period) {
            case Budget.DAY -> day.in(start);
            case Budget.WEEK -> week.in(start);
            default -> month.in(start);
        };
    }

    public Spend add(long at, long amount) {
        return new Spend(
                day.add(Budget.periodStart(Budget.DAY, at), amount),
                week.add(Budget.periodStart(Budget.WEEK, at), amount),
                month.add(Budget.periodStart(Budget.MONTH, at), amount));
    }
}
