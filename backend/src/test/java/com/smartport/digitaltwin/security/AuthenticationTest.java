package com.smartport.digitaltwin.security;

import com.smartport.digitaltwin.config.CorsConfig;
import com.smartport.digitaltwin.controller.ReportController;
import com.smartport.digitaltwin.service.ReportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@WebMvcTest(controllers={AuthController.class,ReportController.class}, properties="app.cors.allowed-origins=http://localhost:5173")
@Import({SecurityConfig.class,CorsConfig.class})
class AuthenticationTest {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder encoder;
    @MockBean AccountService accounts;
    @MockBean AuthRateLimiter limiter;
    @MockBean ReportService reports;
    private void allow() { when(limiter.allow(anyString(),anyString(),anyBoolean())).thenReturn(true); }
    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder login(String password) {
        return post("/api/v1/auth/login").with(csrf()).contentType("application/x-www-form-urlencoded")
            .content("username=test%40example.com&password="+password).param("username","test@example.com").param("password",password);
    }
    @Test void protectedEndpointsAndCsrfAreEnforced() throws Exception {
        mvc.perform(get("/api/v1/reports/summary")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/register").contentType("application/json").content("{}" )).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andExpect(jsonPath("$.token").isString());
        mvc.perform(get("/api/v1/reports/summary").with(user("demo"))).andExpect(status().isOk());
    }
    @Test void bcryptLoginPersistsRotatesSessionAndLogoutInvalidates() throws Exception {
        allow(); String hash=encoder.encode("A-long-test-passphrase");
        assertNotEquals("A-long-test-passphrase",hash); assertTrue(encoder.matches("A-long-test-passphrase",hash));
        when(accounts.loadUserByUsername("test@example.com")).thenReturn(User.withUsername("test@example.com").password(hash).roles("USER").build());
        MockHttpSession before=new MockHttpSession(); String previousId=before.getId();
        var result=mvc.perform(login("A-long-test-passphrase").session(before)).andExpect(status().isNoContent()).andReturn();
        MockHttpSession session=(MockHttpSession)result.getRequest().getSession(false);
        assertNotEquals(previousId,session.getId());
        mvc.perform(get("/api/v1/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.email").value("test@example.com"));
        mvc.perform(post("/api/v1/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertTrue(session.isInvalid());
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void browserCsrfTokenWorksAndRotatesAfterLogin() throws Exception {
        allow();
        when(accounts.loadUserByUsername("test@example.com")).thenReturn(User.withUsername("test@example.com").password(encoder.encode("A-long-test-passphrase")).roles("USER").build());
        var initial=mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn();
        var session=(MockHttpSession)initial.getRequest().getSession(false);
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        var json=mapper.readTree(initial.getResponse().getContentAsString());
        var authenticated=mvc.perform(post("/api/v1/auth/login").session(session)
            .header(json.get("headerName").asText(),json.get("token").asText())
            .contentType("application/x-www-form-urlencoded").content("username=test%40example.com&password=A-long-test-passphrase"))
            .andExpect(status().isNoContent()).andReturn();
        session=(MockHttpSession)authenticated.getRequest().getSession(false);
        mvc.perform(post("/api/v1/auth/logout").session(session).header(json.get("headerName").asText(),json.get("token").asText())).andExpect(status().isForbidden());
        var renewed=mvc.perform(get("/api/v1/auth/csrf").session(session)).andExpect(status().isOk()).andReturn();
        json=mapper.readTree(renewed.getResponse().getContentAsString());
        mvc.perform(post("/api/v1/auth/logout").session(session).header(json.get("headerName").asText(),json.get("token").asText())).andExpect(status().isNoContent());
    }
    @Test void invalidLoginAndExpiredSessionHaveNoAccess() throws Exception {
        allow(); when(accounts.loadUserByUsername(anyString())).thenThrow(new org.springframework.security.core.userdetails.UsernameNotFoundException("not found"));
        mvc.perform(login("incorrect-password")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Invalid email or password"));
        mvc.perform(get("/api/v1/auth/me").cookie(new jakarta.servlet.http.Cookie("JSESSIONID","expired-session"))).andExpect(status().isUnauthorized());
    }
    @Test void throttledRequestsFailClosedAndAdvertiseRetry() throws Exception {
        when(limiter.allow(anyString(),anyString(),anyBoolean())).thenReturn(false); when(limiter.retryAfter()).thenReturn(60);
        mvc.perform(login("A-long-test-passphrase")).andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After","60"));
        verifyNoInteractions(accounts);
        when(limiter.allow(anyString(),anyString(),anyBoolean())).thenThrow(new IllegalStateException());
        mvc.perform(login("A-long-test-passphrase")).andExpect(status().isServiceUnavailable());
    }
    @Test void registrationValidatesAndDuplicateConflictIsSafe() throws Exception {
        allow();
        mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType("application/json").content("{\"email\":\"bad\",\"password\":\"short\"}")).andExpect(status().isBadRequest());
        var valid="{\"email\":\"test@example.com\",\"password\":\"A-long-test-passphrase\"}";
        mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType("application/json").content(valid)).andExpect(status().isCreated());
        doThrow(new org.springframework.dao.DuplicateKeyException("private internal data")).when(accounts).register(anyString(),anyString());
        mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType("application/json").content(valid)).andExpect(status().isConflict()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private internal"))));
    }
    @Test void corsAllowsOnlyConfiguredFrontendAndBodyLimitWorks() throws Exception {
        mvc.perform(options("/api/v1/auth/register").header("Origin","http://localhost:5173").header("Access-Control-Request-Method","POST")).andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Credentials","true"));
        mvc.perform(options("/api/v1/auth/register").header("Origin","https://evil.example").header("Access-Control-Request-Method","POST")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/register").with(csrf()).contentType("application/json").content("x".repeat(8200))).andExpect(status().isPayloadTooLarge());
    }
}
