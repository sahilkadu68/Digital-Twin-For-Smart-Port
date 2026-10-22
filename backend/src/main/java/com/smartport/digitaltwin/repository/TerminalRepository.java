package com.smartport.digitaltwin.repository;

import com.smartport.digitaltwin.model.Terminal;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface TerminalRepository extends MongoRepository<Terminal, String> {
    Optional<Terminal> findByCode(String code);
}
