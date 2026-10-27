package com.smartport.digitaltwin.security;

import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.slf4j.LoggerFactory;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean org.springframework.security.authentication.AuthenticationProvider authenticationProvider(AccountService accounts,PasswordEncoder encoder) {
        var provider=new org.springframework.security.authentication.dao.DaoAuthenticationProvider();
        provider.setUserDetailsService(accounts); provider.setPasswordEncoder(encoder);
        return provider;
    }
    @Bean SecurityFilterChain security(HttpSecurity http,AuthRateLimiter limiter) throws Exception {
        http.cors(cors -> {})
            .csrf(csrf -> csrf.csrfTokenRepository(new HttpSessionCsrfTokenRepository()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/csrf","/api/v1/auth/login","/api/v1/auth/register").permitAll()
                .requestMatchers("/error").permitAll()
                .anyRequest().authenticated())
            .requestCache(cache -> cache.disable())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((req,res,e) -> { res.setStatus(401); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Sign in required\"}"); })
                .accessDeniedHandler((req,res,e) -> { res.setStatus(403); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Request denied. Refresh and try again.\"}"); }))
            .sessionManagement(session -> session.sessionFixation(fix -> fix.changeSessionId()))
            .formLogin(login -> login.loginProcessingUrl("/api/v1/auth/login")
                .successHandler((req,res,auth) -> { LoggerFactory.getLogger(SecurityConfig.class).info("User sign-in succeeded"); res.setStatus(204); })
                .failureHandler((req,res,e) -> { LoggerFactory.getLogger(SecurityConfig.class).warn("User sign-in failed"); res.setStatus(401); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Invalid email or password\"}"); }))
            .logout(logout -> logout.logoutUrl("/api/v1/auth/logout").invalidateHttpSession(true).clearAuthentication(true).deleteCookies("JSESSIONID")
                .logoutSuccessHandler((req,res,auth) -> { LoggerFactory.getLogger(SecurityConfig.class).info("User signed out"); res.setStatus(204); }))
            .addFilterBefore(new AuthProtectionFilter(limiter),UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
