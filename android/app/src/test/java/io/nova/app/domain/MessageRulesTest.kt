package io.nova.app.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

class MessageRulesTest {
    @Test fun trimsAndRejectsEmptyMessage() {
        assertEquals("hello", MessageRules.normalizedText("  hello  "))
        assertNull(MessageRules.normalizedText("  \n"))
    }

    @Test fun enforcesContractMaximumTextLength() {
        assertEquals(10_000, MessageRules.normalizedText("x".repeat(10_000))?.length)
        assertNull(MessageRules.normalizedText("x".repeat(10_001)))
    }

    @Test fun idempotencyKeysAreValidUniqueUuids() {
        val first = MessageRules.newIdempotencyKey()
        val second = MessageRules.newIdempotencyKey()
        assertNotNull(UUID.fromString(first))
        assertNotEquals(first, second)
    }

    @Test fun statusesAreExplicitAndHonest() {
        assertEquals("Отправляется", MessageRules.statusLabel("PENDING"))
        assertEquals("Отправлено", MessageRules.statusLabel("SENT"))
        assertEquals("Не отправлено", MessageRules.statusLabel("FAILED"))
    }
}
