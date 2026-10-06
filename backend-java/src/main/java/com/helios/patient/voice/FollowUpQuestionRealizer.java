package com.helios.patient.voice;

import org.springframework.stereotype.Component;

import com.helios.patient.intake.FollowUpIntent;

@Component
public class FollowUpQuestionRealizer {

    public String realize(FollowUpIntent intent) {
        if (intent == null || intent.targetField() == null) {
            throw new IllegalArgumentException("follow-up intent is required");
        }
        return switch (intent.targetField()) {
            case "chiefComplaint" ->
                    "Aaj aapko kis health concern ya takleef ke baare mein doctor ko batana hai?";
            case "onset" -> "Yeh problem kab se shuru hui?";
            case "severity" -> "Agar zero se ten tak batayein, abhi takleef kitni severe hai?";
            case "pattern" -> "Yeh takleef lagataar rehti hai, beech beech mein aati hai, ya badal rahi hai?";
            case "associatedSymptoms" -> "Iske saath koi aur symptom ya takleef bhi ho rahi hai?";
            case "breathingDifficulty" -> "Kya iske saath saans lene mein dikkat ho rahi hai?";
            case "faintingOrSweating" -> "Kya chakkar, behoshi, ya unusual paseena bhi hua hai?";
            case "radiatingDiscomfort" -> "Kya discomfort arm, jaw, back, ya shoulder tak ja raha hai?";
            case "suddenSevereOnset" -> "Kya yeh achanak bahut tez shuru hua tha?";
            case "neurologicalSymptoms" -> "Kya weakness, bolne mein dikkat, ya vision change hua hai?";
            case "severeAbdominalFeatures" -> "Kya pain bahut tezi se badh raha hai, behoshi hui hai, ya heavy bleeding hui hai?";
            case "aggravatingRelievingFactors" -> "Activity, rest, khana, position, ya kisi aur cheez se yeh better ya worse hota hai?";
            case "location" -> "Takleef exactly kahan feel ho rahi hai?";
            case "gastrointestinalSymptoms" -> "Kya vomiting, loose motions, constipation, ya bowel habit mein change hai?";
            case "rashDistribution" -> "Skin change kahan hai, aur kya woh spread ho raha hai?";
            default -> "Is concern ke baare mein thoda aur detail mein batayenge?";
        };
    }
}
