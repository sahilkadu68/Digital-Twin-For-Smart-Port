package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.dto.*;
import com.smartport.digitaltwin.dto.ReportOperationsDto.YardRow;
import com.smartport.digitaltwin.model.*;
import java.util.*;
import java.time.*;

public final class ReportOperations {
    private ReportOperations() {}
    public static int teuFactor(String type) {
        return "20ft".equals(type) ? 1 : Set.of("40ft","40ft-HC","45ft-HC").contains(type==null?"":type) ? 2 : 0;
    }
    public static boolean validWeight(Container c) { return Double.isFinite(c.getWeight()) && c.getWeight()>=0; }
    public static ReportOperationsDto build(List<Container> filtered,List<Terminal> terminals,String scope,EnvironmentSnapshotDto environment) {
        List<Container> active=filtered.stream().filter(InventoryRules::occupiesYard).toList();
        Map<String,Long> quality=new LinkedHashMap<>();
        quality.put("unknownContainerTypes",filtered.stream().filter(c->teuFactor(c.getType())==0).count());
        quality.put("invalidWeights",filtered.stream().filter(c->!validWeight(c)).count());
        quality.put("missingOrInvalidArrivalDates",filtered.stream().filter(c->InventoryRules.arrivalDate(c.getArrivalDate()).isEmpty()).count());
        quality.put("missingContainerNumbers",filtered.stream().filter(c->c.getContainerNumber()==null||c.getContainerNumber().isBlank()).count());
        quality.put("invalidBasicPlacements",active.stream().filter(c->blank(c.getYard())||blank(c.getBlock())||c.getRow()<1||c.getColumn()<1||c.getLevel()<1||c.getLevel()>4).count());
        Map<String,Long> numbers=new HashMap<>(),slots=new HashMap<>();
        for(Container c:filtered) if(!blank(c.getContainerNumber())) numbers.merge(c.getContainerNumber(),1L,Long::sum);
        for(Container c:active) slots.merge(Arrays.asList(c.getTerminal(),c.getYard(),c.getBlock(),c.getRow(),c.getColumn(),c.getLevel()).toString(),1L,Long::sum);
        quality.put("duplicateContainerNumberGroups",numbers.values().stream().filter(n->n>1).count());
        quality.put("conflictingSlotGroups",slots.values().stream().filter(n->n>1).count());
        Map<String,Long> capacities=new TreeMap<>();
        Set<String> invalidCapacity=new HashSet<>();
        for(Terminal t:terminals) if(InventoryRules.matches(t.getCode(),scope)) {
            String code=InventoryRules.key(t.getCode());
            if(capacities.containsKey(code)||t.getYardCapacity()<=0) invalidCapacity.add(code);
            capacities.putIfAbsent(code,(long)Math.max(0,t.getYardCapacity()));
        }
        Map<String,Long> occupancy=new TreeMap<>();
        for(Container c:active) occupancy.merge(InventoryRules.key(c.getTerminal()),1L,Long::sum);
        Set<String> codes=new TreeSet<>(capacities.keySet()); codes.addAll(occupancy.keySet());
        List<YardRow> rows=new ArrayList<>(); boolean complete=!codes.isEmpty();
        for(String code:codes) {
            long count=occupancy.getOrDefault(code,0L),capacity=capacities.getOrDefault(code,0L);
            Double utilization=capacity>0&&!invalidCapacity.contains(code)?round(count*100./capacity):null;
            if(utilization==null) complete=false;
            rows.add(new YardRow(code,count,capacity,utilization,utilization==null?"Capacity unavailable":utilization>=100?"At/above capacity":utilization>=85?"High (>=85%)":"Within capacity"));
        }
        long capacity=capacities.values().stream().mapToLong(Long::longValue).sum();
        Double utilization=complete&&capacity>0?round(active.size()*100./capacity):null;
        List<String> notes=new ArrayList<>(List.of(
            "Active means status other than gate-out; total records, TEUs and weight include all matching statuses.",
            "Utilization is matching active records / selected terminal capacity. Date, trade and status filters create a cohort estimate, not historical/as-of occupancy; capacity units follow stored yardCapacity, not surveyed slots.",
            "20ft=1 TEU; 40ft, 40ft-HC and 45ft-HC=2 by project convention. Unknown sizes are excluded from TEUs.",
            "Weight is recorded kilograms / 1000; negative/non-finite weights excluded. Missing primitive numeric values cannot be distinguished from zero.",
            "Arrival counts are not throughput or gate movements. Source inventory has no last-updated timestamp; generatedAt is query time, not data freshness.",
            "Quality counts cover the filtered cohort; placement checks are basic field/level checks, not geographic verification or full stack validation.",
            "Environmental snapshot is latest available port-wide reference data, independent of inventory filters; provenance is unverified/simulated. Stale means older than 24 hours; application display conditions are not regulatory certification.",
            "No vehicle movements, berth productivity or live traffic performance are inferred. Traffic scenarios elsewhere in the application are simulated."));
        if(!complete||capacity==0) notes.add("Some capacities are missing, zero or duplicated; affected utilization values are unavailable.");
        Boolean stale=null;
        if(environment==null) notes.add("No environmental snapshot available.");
        else try {
            Instant time=Instant.parse(environment.getTimestamp());
            stale=time.isBefore(Instant.now().minus(Duration.ofHours(24)))||time.isAfter(Instant.now().plusSeconds(300));
            if(stale) notes.add("Environmental timestamp is stale or in the future; do not treat it as a current observation.");
        } catch(Exception e) { notes.add("Environmental timestamp could not be validated."); }
        return new ReportOperationsDto(active.size(),filtered.size()-active.size(),capacity,utilization,rows,quality,environment,stale,notes);
    }
    private static boolean blank(String s) { return s==null||s.isBlank(); }
    private static double round(double value) { return Math.round(value*10.)/10.; }
}
