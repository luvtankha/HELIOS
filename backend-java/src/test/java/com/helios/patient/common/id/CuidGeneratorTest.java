package com.helios.patient.common.id;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CuidGeneratorTest {

    @Test
    void generatesLegacyCompatibleCuidShape() {
        String value = new CuidGenerator().next();
        assertThat(value).matches("c[0-9a-z]{24}");
    }
}

