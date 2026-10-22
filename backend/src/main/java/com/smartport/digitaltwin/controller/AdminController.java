package com.smartport.digitaltwin.controller;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    @PostMapping("/reseed")
    public ResponseEntity<Map<String, String>> reseed() {
        return ResponseEntity.status(410).body(Map.of("message", "Reseeding disabled: existing records are protected."));
    }
}
