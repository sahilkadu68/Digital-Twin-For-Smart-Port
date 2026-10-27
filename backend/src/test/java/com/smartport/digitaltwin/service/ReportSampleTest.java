package com.smartport.digitaltwin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClients;
import com.smartport.digitaltwin.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;

/** Optional read-only check against existing data. Writes only the requested sample DTO. */
@EnabledIfEnvironmentVariable(named="REPORT_SAMPLE_PATH", matches=".+")
class ReportSampleTest {
    @Test void exportExistingSnapshotAndReconcileDashboard() throws Exception {
        String uri=System.getenv().getOrDefault("MONGODB_URI", "mongodb://127.0.0.1:27017/smart_port_digital_twin");
        var connection=new com.mongodb.ConnectionString(uri);
        try(var client=MongoClients.create(connection)) {
            var mongo=new MongoTemplate(client, connection.getDatabase());
            var factory=new MongoRepositoryFactory(mongo);
            var containers=factory.getRepository(ContainerRepository.class);
            var terminals=factory.getRepository(TerminalRepository.class);
            var environment=factory.getRepository(EnvironmentReadingRepository.class);
            long before=containers.count();
            var report=new ReportService(containers,terminals,new EnvironmentService(environment)).buildSummary("ALL","ALL",null,null,"ALL");
            var dashboard=new ContainerService(containers,terminals).getYardStats();
            assertEquals(dashboard.getTotalContainers(), report.getTotalContainers());
            assertEquals(dashboard.getTotalCapacity(), report.getOperations().capacity());
            assertEquals(dashboard.getUtilizationPercent(), report.getOperations().utilizationPercent());
            assertEquals(before,containers.count());
            Path output=Path.of(System.getenv("REPORT_SAMPLE_PATH"));
            Files.createDirectories(output.getParent());
            new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(output.toFile(),report);
            System.out.println("Sample uses existing MongoDB records; container totals, capacity and utilization reconcile with dashboard service.");
        }
    }
}
