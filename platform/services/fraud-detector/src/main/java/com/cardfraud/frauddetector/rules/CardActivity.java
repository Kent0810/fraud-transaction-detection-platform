package com.cardfraud.frauddetector.rules;

import java.util.ArrayList;
import java.util.List;

// Per-card state for R1 and R3. Times are simulated seconds: event time x TIME_SCALE.
public record CardActivity(List<Long> recent, Place lastInPerson) {
    public record Place(long at, double lat, double lng) {
    }

    public static final long VELOCITY_SECONDS = 3600;

    public static final CardActivity NONE = new CardActivity(List.of(), null);

    public int paymentsWithinHour(long now) {
        return (int) recent.stream().filter(t -> t > now - VELOCITY_SECONDS && t <= now).count();
    }

    public CardActivity add(long at, Double lat, Double lng, boolean inPerson, boolean allowed) {
        List<Long> next = new ArrayList<>();
        for (Long t : recent) {
            if (t > at - VELOCITY_SECONDS) {
                next.add(t);
            }
        }
        next.add(at);
        if (!allowed || !inPerson || lat == null || lng == null) {
            return new CardActivity(next, lastInPerson);
        }
        return new CardActivity(next, new Place(at, lat, lng));
    }
}
