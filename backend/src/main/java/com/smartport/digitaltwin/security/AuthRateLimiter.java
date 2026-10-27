package com.smartport.digitaltwin.security;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Service;
import org.springframework.dao.DuplicateKeyException;
import java.time.*;
import java.util.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

/** Atomic MongoDB fixed-window counters shared by all application instances. */
@Service
public class AuthRateLimiter {
    private final MongoTemplate mongo;
    private final int seconds, ipLimit, accountLimit;
    private volatile boolean indexed;
    public AuthRateLimiter(MongoTemplate mongo, @Value("${app.auth.rate.window-seconds:900}") int seconds,
                           @Value("${app.auth.rate.ip-limit:30}") int ipLimit,
                           @Value("${app.auth.rate.account-limit:10}") int accountLimit) {
        this.mongo=mongo; this.seconds=Math.max(1,seconds); this.ipLimit=Math.max(1,ipLimit); this.accountLimit=Math.max(1,accountLimit);
    }
    public int retryAfter() { return seconds - (int)(Instant.now().getEpochSecond() % seconds); }
    public boolean allow(String ip, String account, boolean login) {
        if (!indexed) synchronized(this) {
            if (!indexed) { mongo.indexOps("auth_rate_limits").ensureIndex(new Index().on("expiresAt", org.springframework.data.domain.Sort.Direction.ASC).expire(Duration.ZERO)); indexed=true; }
        }
        boolean client = consume("ip:"+ip,ipLimit);
        // Account counter limits password guessing; registration is limited per IP.
        boolean user = !login || consume("account:"+AccountService.normalize(account),accountLimit);
        return client && user;
    }
    private boolean consume(String key, int limit) {
        long window=Instant.now().getEpochSecond()/seconds;
        String digest;
        try { digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e) { throw new IllegalStateException("Digest unavailable"); }
        Query query=Query.query(Criteria.where("_id").is(window+":"+digest));
        Update update=new Update().inc("attempts",1).setOnInsert("expiresAt",Date.from(Instant.ofEpochSecond((window+2)*seconds)));
        Document counter;
        try { counter=mongo.findAndModify(query,update,FindAndModifyOptions.options().upsert(true).returnNew(true),Document.class,"auth_rate_limits"); }
        catch(DuplicateKeyException race) { counter=mongo.findAndModify(query,new Update().inc("attempts",1),FindAndModifyOptions.options().returnNew(true),Document.class,"auth_rate_limits"); }
        return counter!=null && ((Number)counter.get("attempts")).longValue()<=limit;
    }
}
