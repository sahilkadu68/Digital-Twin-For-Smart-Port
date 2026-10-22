package com.smartport.digitaltwin.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartport.digitaltwin.model.TrafficRecord;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

/** Explicit opt-in. Never invokes DataSeeder or writes any operational collection. */
@Component
@ConditionalOnProperty(name = "app.traffic.seed", havingValue = "true")
public class TrafficSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(TrafficSeeder.class);
    private final MongoTemplate mongo;
    private final ObjectMapper mapper;
    private final String source;
    public TrafficSeeder(MongoTemplate mongo, ObjectMapper mapper,
                         @Value("${app.traffic.source:../jnpa_roads_candidate.geojson}") String source) {
        this.mongo = mongo; this.mapper = mapper; this.source = source;
    }
    @Override public void run(String... args) throws Exception {
        // Validate/generate the COMPLETE source before the first database write.
        var data = TrafficGenerator.read(Files.readAllBytes(Path.of(source)), mapper);
        var records = TrafficGenerator.generate(data, Instant.now().toString());
        mongo.indexOps(TrafficRecord.class).ensureIndex(new Index().on("roadId", Sort.Direction.ASC)
                .on("scenario", Sort.Direction.ASC).unique().named("traffic_road_scenario"));
        var bulk = mongo.bulkOps(BulkOperations.BulkMode.UNORDERED, TrafficRecord.class);
        for (TrafficRecord record : records) {
            Document document = new Document(); mongo.getConverter().write(record, document); document.remove("_id");
            Update insert = new Update(); document.forEach(insert::setOnInsert);
            bulk.upsert(Query.query(Criteria.where("_id").is(record.id())), insert);
        }
        var result = bulk.execute();
        log.info("SIMULATED traffic: {} source roads, {} expected records, {} inserted; existing records unchanged; SHA-256 {}",
                data.roads().size(), records.size(), result.getUpserts().size(), data.sha256());
    }
}
