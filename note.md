Flow
1. Prepare Stream -> CSV (data/stream/events.csv) -> Event Source (service) -> Kafka (topic: transactions) -> Fraud Detection (service) -> Kafka (topic: decisions) -> Consumed by Backend (card-holder-app/backend) (settle consumer -> write to Table: transactions, ledger_entries, update account balance(using trigger from ledger_entries), outbox) -> outbox (differentiate via aggregate_type field) -> (via Debezium) Kafka (topic: settlements (sender) and credits (recipient)) -> sink Cassandra (txn_by_card)

Purpose of tables:

PostgreSQL
- transactions: 
    - from event source
        - 
    - from mobile app
        - PENDING entry -> outbox ingested by fraud dection then it will update that entry right? 

- ledger_entries
- account
- outbox (important)

Cassandra


2. 

data in postgreSQL (seeded by infra/postgres/seed -> run by postgres-seed service)
- CardHolders personal information (using dim.csv)
- Accounts (add 100tr) and Auth


Disadvantage
- Cassandra is eventually consistency since it take multiple steps to write data to it