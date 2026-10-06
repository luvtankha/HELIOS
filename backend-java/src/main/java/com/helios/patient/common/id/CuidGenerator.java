package com.helios.patient.common.id;

import java.security.SecureRandom;

import org.springframework.stereotype.Component;

@Component
public class CuidGenerator {

    private static final char[] ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz".toCharArray();
    private static final int PAYLOAD_LENGTH = 24;

    private final SecureRandom random = new SecureRandom();

    public String next() {
        var value = new StringBuilder(1 + PAYLOAD_LENGTH).append('c');
        for (int index = 0; index < PAYLOAD_LENGTH; index++) {
            value.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        }
        return value.toString();
    }
}

