package com.smartport.digitaltwin.controller;

import com.smartport.digitaltwin.model.Terminal;
import com.smartport.digitaltwin.repository.TerminalRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/terminals")
public class TerminalController {

    private final TerminalRepository terminalRepo;

    public TerminalController(TerminalRepository terminalRepo) {
        this.terminalRepo = terminalRepo;
    }

    @GetMapping
    public List<Terminal> getTerminals() {
        return terminalRepo.findAll();
    }

    @GetMapping("/{code}")
    public ResponseEntity<Terminal> getTerminalByCode(@PathVariable String code) {
        return terminalRepo.findByCode(code)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
