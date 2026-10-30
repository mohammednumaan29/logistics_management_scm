package com.disruptioniq.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.neo4j.core.Neo4jClient;

@Configuration
public class WebhookSchemaInitializer {

    @Bean
    ApplicationRunner carrierWebhookConstraintInitializer(
            Neo4jClient neo4jClient) {

        return args -> neo4jClient.query("""
            CREATE CONSTRAINT carrier_webhook_event_id_unique
            IF NOT EXISTS
            FOR (e:CarrierWebhookEvent)
            REQUIRE e.eventId IS UNIQUE
            """).run();
    }
}