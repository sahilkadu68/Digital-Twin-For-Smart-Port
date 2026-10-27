package com.smartport.digitaltwin.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;
import org.slf4j.LoggerFactory;

public class AuthProtectionFilter extends OncePerRequestFilter {
    private final AuthRateLimiter limiter;
    public AuthProtectionFilter(AuthRateLimiter limiter) { this.limiter=limiter; }
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
        String path=req.getRequestURI().substring(req.getContextPath().length());
        if ("POST".equals(req.getMethod()) && (path.equals("/api/v1/auth/login") || path.equals("/api/v1/auth/register"))) {
            // Require bounded bodies, including for form login, before parameter parsing.
            if (req.getContentLengthLong()<0 || req.getContentLengthLong()>8192) {
                res.setStatus(413); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Authentication request exceeds size limit or has no Content-Length\"}"); return;
            }
            boolean login=path.endsWith("/login");
            if (login && (req.getParameter("username")==null || req.getParameter("username").length()>254 || req.getParameter("password")==null || req.getParameter("password").length()>72)) {
                res.setStatus(400); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Invalid sign-in request\"}"); return;
            }
            try {
                if(!limiter.allow(req.getRemoteAddr(),login?req.getParameter("username"):"",login)) {
                    LoggerFactory.getLogger(getClass()).warn("Authentication request throttled");
                    res.setStatus(429); res.setHeader("Retry-After",String.valueOf(limiter.retryAfter()));
                    res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Too many attempts. Try again later.\"}"); return;
                }
            } catch (RuntimeException unavailable) {
                res.setStatus(503); res.setContentType("application/json"); res.getWriter().write("{\"message\":\"Authentication temporarily unavailable\"}"); return;
            }
        }
        chain.doFilter(req,res);
    }
}
