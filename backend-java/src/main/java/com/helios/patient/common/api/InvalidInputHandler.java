package com.helios.patient.common.api;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Invalid model/browser input must not become a server error or echo clinical data. */
@RestControllerAdvice
public class InvalidInputHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidInput(IllegalArgumentException exception) {
        return Map.of("error", "Invalid request data");
    }
}
