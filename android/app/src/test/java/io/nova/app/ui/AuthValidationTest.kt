package io.nova.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthValidationTest {
    @Test fun acceptsCommonEmailAddressesAndTrimsWhitespace() {
        assertTrue(AuthValidation.isEmailValid("user@example.com"))
        assertTrue(AuthValidation.isEmailValid("nova.user+tag@example.co.uk"))
        assertTrue(AuthValidation.isEmailValid("  user@example.com  "))
    }

    @Test fun rejectsIncompleteOrOversizedAddresses() {
        assertFalse(AuthValidation.isEmailValid(""))
        assertFalse(AuthValidation.isEmailValid("user"))
        assertFalse(AuthValidation.isEmailValid("user@"))
        assertFalse(AuthValidation.isEmailValid("user@example"))
        assertFalse(AuthValidation.isEmailValid("user name@example.com"))
        assertFalse(AuthValidation.isEmailValid("a".repeat(321) + "@example.com"))
    }

    @Test fun explainsEmulatorOnlyAddressInDebugBuild() {
        val message = AuthNetworkMessages.connectionFailure("http://10.0.2.2:3001", debug = true)
        assertTrue(message.contains("Android Emulator"))
        assertTrue(message.contains("обычном телефоне"))
        assertTrue(message.contains("письмо не отправлено"))
    }

    @Test fun doesNotMislabelOtherApiHostsAsEmulator() {
        val message = AuthNetworkMessages.connectionFailure("https://api.nova.example", debug = true)
        assertFalse(message.contains("10.0.2.2"))
        assertTrue(message.contains("сервером NOVA"))
    }
}
