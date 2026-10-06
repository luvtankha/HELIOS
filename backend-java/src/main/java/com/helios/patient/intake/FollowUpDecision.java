package com.helios.patient.intake;

public record FollowUpDecision(
        boolean complete,
        FollowUpIntent nextIntent,
        String reason) {

    public static FollowUpDecision ask(FollowUpIntent intent, String reason) {
        return new FollowUpDecision(false, intent, reason);
    }

    public static FollowUpDecision complete(String reason) {
        return new FollowUpDecision(true, null, reason);
    }
}

