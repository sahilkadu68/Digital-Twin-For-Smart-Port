package com.smartport.digitaltwin.security;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Document("user_accounts")
public record UserAccount(@Id String email, @JsonIgnore String passwordHash) {}
