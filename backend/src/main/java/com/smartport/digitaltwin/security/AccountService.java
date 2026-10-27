package com.smartport.digitaltwin.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.Locale;

@Service
public class AccountService implements UserDetailsService {
    private final MongoTemplate mongo;
    private final PasswordEncoder encoder;
    private final boolean registrationEnabled;
    public AccountService(MongoTemplate mongo, PasswordEncoder encoder,
                          @Value("${app.auth.registration-enabled:true}") boolean registrationEnabled) {
        this.mongo = mongo; this.encoder = encoder; this.registrationEnabled = registrationEnabled;
    }
    public static String normalize(String email) { return email.trim().toLowerCase(Locale.ROOT); }
    @Override public UserDetails loadUserByUsername(String email) {
        UserAccount account = mongo.findById(normalize(email), UserAccount.class);
        if (account == null) throw new UsernameNotFoundException("Invalid credentials");
        return User.withUsername(account.email()).password(account.passwordHash()).roles("USER").build();
    }
    public void register(String email, String password) {
        if (!registrationEnabled) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Registration is disabled");
        // _id is the normalized email: MongoDB enforces uniqueness atomically.
        mongo.insert(new UserAccount(normalize(email), encoder.encode(password)));
    }
}
