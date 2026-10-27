package com.smartport.digitaltwin.security;

import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.bson.Document;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class AccountAndRateLimiterTest {
    @Test void registrationStoresOnlyHashAndNormalizesEmail() {
        MongoTemplate mongo=mock(MongoTemplate.class); var encoder=new BCryptPasswordEncoder(4);
        var accounts=new AccountService(mongo,encoder,true);
        accounts.register("  Test@Example.com  ","A-long-test-passphrase");
        var stored=ArgumentCaptor.forClass(UserAccount.class); verify(mongo).insert(stored.capture());
        assertEquals("test@example.com",stored.getValue().email());
        assertTrue(encoder.matches("A-long-test-passphrase",stored.getValue().passwordHash()));
        assertNotEquals("A-long-test-passphrase",stored.getValue().passwordHash());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->new AccountService(mongo,encoder,false).register("x@example.com","passphrase"));
    }
    @Test void sharedAtomicCountersEnforceLimitsAndExpire() {
        MongoTemplate mongo=mock(MongoTemplate.class); IndexOperations indexes=mock(IndexOperations.class);
        when(mongo.indexOps("auth_rate_limits")).thenReturn(indexes);
        when(mongo.findAndModify(any(Query.class),any(Update.class),any(FindAndModifyOptions.class),eq(Document.class),eq("auth_rate_limits")))
            .thenReturn(new Document("attempts",1),new Document("attempts",1),new Document("attempts",2),new Document("attempts",2));
        var limiter=new AuthRateLimiter(mongo,900,1,1);
        assertTrue(limiter.allow("127.0.0.1","user@example.com",true));
        assertFalse(limiter.allow("127.0.0.1","user@example.com",true));
        assertTrue(limiter.retryAfter()>0&&limiter.retryAfter()<=900);
        verify(indexes,times(1)).ensureIndex(any());
    }
}
