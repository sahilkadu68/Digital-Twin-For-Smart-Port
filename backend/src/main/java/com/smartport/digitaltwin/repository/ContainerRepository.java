package com.smartport.digitaltwin.repository;

import com.smartport.digitaltwin.model.Container;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ContainerRepository extends MongoRepository<Container, String> {
    List<Container> findByTerminal(String terminal);
    List<Container> findByStatus(String status);
    List<Container> findByTerminalAndStatus(String terminal, String status);
    Optional<Container> findByContainerNumber(String containerNumber);
    List<Container> findByContainerNumberContainingIgnoreCase(String query);
    long countByTerminal(String terminal);
    long countByStatus(String status);
}
