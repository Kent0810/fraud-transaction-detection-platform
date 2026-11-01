package com.cardfraud.frauddetector.rules;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Set;

// A card's spending limit per period (BR5), from the cardholder's SET_BUDGET.
public record Budget(long limit, String period) {
    public static final String DAY = "DAY";
    public static final String WEEK = "WEEK";
    public static final String MONTH = "MONTH";
    public static final Set<String> PERIODS = Set.of(DAY, WEEK, MONTH);

    // Periods are calendar days, weeks (from Monday) and months in Vietnam time.
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    // Epoch second at which the period holding `at` (epoch second) starts.
    public static long periodStart(String period, long at) {
        LocalDate date = Instant.ofEpochSecond(at).atZone(ZONE).toLocalDate();
        LocalDate first = switch (period) {
            case DAY -> date;
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> date.withDayOfMonth(1);
            default -> throw new IllegalArgumentException("unknown budget period " + period);
        };
        return first.atStartOfDay(ZONE).toEpochSecond();
    }
}
