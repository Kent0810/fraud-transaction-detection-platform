export class ConfigError extends Error {}

export type CassandraConfig = {
  contactPoints: string[];
  cassandraPort: number;
  localDc: string;
  keyspace: string;
};

export type KafkaConfig = {
  kafkaBrokers: string[];
  controlTopic: string;
  decisionsTopic: string;
  transferDecisionsTopic: string;
};

export type PostgresConfig = {
  postgresHost: string;
  postgresPort: number;
  postgresDb: string;
  postgresUser: string;
  postgresPassword: string;
};

export type Config = CassandraConfig & KafkaConfig & PostgresConfig & { port: number };

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`${name} is not set`);
  }
  return value;
}

function int(name: string, raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new ConfigError(`${name} must be a whole number, got '${raw}'`);
  }
  return n;
}

function list(name: string): string[] {
  return required(name)
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
}

export function loadCassandraConfig(): CassandraConfig {
  return {
    contactPoints: list('CASSANDRA_CONTACT_POINTS'),
    cassandraPort: int('CASSANDRA_PORT', required('CASSANDRA_PORT')),
    localDc: required('CASSANDRA_LOCAL_DC'),
    keyspace: required('CASSANDRA_KEYSPACE'),
  };
}

export function loadKafkaConfig(): KafkaConfig {
  return {
    kafkaBrokers: list('KAFKA_BOOTSTRAP_SERVERS'),
    controlTopic: required('TOPIC_CONTROL'),
    decisionsTopic: required('TOPIC_DECISIONS'),
    transferDecisionsTopic: required('TOPIC_TRANSFER_DECISIONS'),
  };
}

export function loadPostgresConfig(): PostgresConfig {
  return {
    postgresHost: required('POSTGRES_HOST'),
    postgresPort: int('POSTGRES_PORT', required('POSTGRES_PORT')),
    postgresDb: required('POSTGRES_DB'),
    postgresUser: required('POSTGRES_USER'),
    postgresPassword: required('POSTGRES_PASSWORD'),
  };
}

export function loadConfig(): Config {
  return {
    port: int('PORT', process.env.PORT ?? '8080'),
    ...loadCassandraConfig(),
    ...loadKafkaConfig(),
    ...loadPostgresConfig(),
  };
}
