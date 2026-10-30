
package com.disruptioniq.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

@Component
public class SeedDataInitializer implements ApplicationRunner {

    private final Neo4jClient neo4jClient;

    public SeedDataInitializer(Neo4jClient neo4jClient) {
        this.neo4jClient = neo4jClient;
    }

    @Override
    public void run(ApplicationArguments args) {
        seedDemoData();
    }

    private void seedDemoData() {
        String cypher = """
            MERGE (s:Supplier {id: 'SUP-001'})
            ON CREATE SET
                s.name = 'Global Components Ltd',
                s.status = 'ACTIVE',
                s.leadTimeDays = 7

            MERGE (w:Warehouse {id: 'WH-001'})
            ON CREATE SET
                w.name = 'Chennai Central Warehouse',
                w.location = 'Chennai',
                w.capacity = 10000

            MERGE (p:Product {id: 'PROD-100'})
            ON CREATE SET
                p.name = 'Industrial Sensor',
                p.category = 'Electronics',
                p.unitCost = 120.00

            MERGE (sh:Shipment {id: 'SH-102'})
            ON CREATE SET
                sh.quantity = 120,
                sh.status = 'DELAYED',
                sh.expectedDelivery = date('2026-10-28')

            MERGE (i:Inventory {id: 'INV-001'})
            ON CREATE SET
                i.onHand = 100,
                i.reserved = 40,
                i.reorderPoint = 50,
                i.dailyDemand = 30

            MERGE (c:Customer {id: 'CUS-101'})
            ON CREATE SET
                c.name = 'Acme Industrial',
                c.email = 'customer@example.com'

            MERGE (o:Order {id: 'ORD-204'})
            ON CREATE SET
                o.priority = 'HIGH',
                o.quantity = 50,
                o.promisedDelivery = date('2026-10-27'),
                o.status = 'AT_RISK'

            MERGE (s)-[:SENDS]->(sh)
            MERGE (sh)-[:DELIVERS_TO]->(w)
            MERGE (w)-[:STORES]->(i)
            MERGE (i)-[:FOR]->(p)
            MERGE (p)-[:REQUIRED_BY]->(o)
            MERGE (o)-[:PLACED_BY]->(c)
            """;

        neo4jClient.query(cypher).run();
    }
}
