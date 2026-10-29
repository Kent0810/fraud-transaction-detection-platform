package com.cardfraud.frauddetector.model;

public record ControlEvent(String action, String controlId, String kind) {

    public static final String FREEZE = "FREEZE_CARD";
    public static final String UNFREEZE = "UNFREEZE_CARD";

    public boolean isFreezeChange() {
        return FREEZE.equals(action) || UNFREEZE.equals(action);
    }

    public boolean freezes() {
        return FREEZE.equals(action);
    }
}
