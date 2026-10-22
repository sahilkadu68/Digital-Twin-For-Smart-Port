package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.model.Container;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Read-time compatibility rules; never rewrites stored documents. */
public final class InventoryRules {
    public static final ZoneId PORT_ZONE = ZoneId.of("Asia/Kolkata");
    private InventoryRules() {}
    public static String key(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim();
    }
    public static boolean matches(String stored, String filter) {
        return filter == null || filter.isBlank() || "all".equalsIgnoreCase(filter.trim())
                || key(stored).equalsIgnoreCase(filter.trim());
    }
    public static String trade(Container c) {
        if (c.getTradeCategory() != null && !c.getTradeCategory().isBlank())
            return c.getTradeCategory().trim().toLowerCase(Locale.ROOT);
        String legacy = key(c.getStatus()).toLowerCase(Locale.ROOT);
        return Set.of("import", "export", "transshipment").contains(legacy) ? legacy : "unknown";
    }
    public static boolean occupiesYard(Container c) {
        return !"gate-out".equalsIgnoreCase(key(c.getStatus()));
    }
    public static Optional<LocalDate> arrivalDate(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        try { return Optional.of(LocalDate.parse(value.trim())); }
        catch (DateTimeParseException ignored) {
            try { return Optional.of(OffsetDateTime.parse(value.trim()).atZoneSameInstant(PORT_ZONE).toLocalDate()); }
            catch (DateTimeParseException invalid) { return Optional.empty(); }
        }
    }
    public static LocalDate requestDate(String value) {
        if (value == null || value.isBlank()) return null;
        try { return LocalDate.parse(value); }
        catch (DateTimeParseException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dates must use yyyy-MM-dd");
        }
    }
    public static void validateRange(LocalDate start, LocalDate end) {
        if (start != null && end != null && start.isAfter(end))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startDate must not exceed endDate");
    }
    public static boolean inRange(Container c, LocalDate start, LocalDate end) {
        if (start == null && end == null) return true;
        return arrivalDate(c.getArrivalDate()).map(d -> (start == null || !d.isBefore(start))
                && (end == null || !d.isAfter(end))).orElse(false);
    }
}
