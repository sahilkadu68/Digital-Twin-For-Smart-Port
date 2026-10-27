package com.smartport.digitaltwin.security;



import org.springframework.web.bind.annotation.*;

import org.springframework.http.*;

import org.springframework.web.bind.MethodArgumentNotValidException;

import org.springframework.web.server.ResponseStatusException;

import org.springframework.dao.DuplicateKeyException;

import java.util.Map;



@RestControllerAdvice

public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)

    ResponseEntity<?> validation(MethodArgumentNotValidException e) {

        return ResponseEntity.badRequest().body(Map.of("message","Enter a valid email and a password of 12–72 characters (at most 72 UTF-8 bytes)."));

    }

    @ExceptionHandler(DuplicateKeyException.class)

    ResponseEntity<?> duplicate() { return ResponseEntity.status(409).body(Map.of("message","Account could not be created. Use another email or sign in.")); }

    @ExceptionHandler(ResponseStatusException.class)

    ResponseEntity<?> status(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",e.getReason()==null?"Request failed":e.getReason())); }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)

    ResponseEntity<?> malformed() { return ResponseEntity.badRequest().body(Map.of("message","Invalid request body")); }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    ResponseEntity<?> invalidParameter() { return ResponseEntity.badRequest().body(Map.of("message","Invalid request parameter")); }
    @ExceptionHandler(Exception.class)

    ResponseEntity<?> unexpected(Exception e) {

        org.slf4j.LoggerFactory.getLogger(getClass()).error("API request failed: {}",e.getClass().getSimpleName());

        return ResponseEntity.status(500).body(Map.of("message","Request could not be completed. Try again later."));

    }

}
