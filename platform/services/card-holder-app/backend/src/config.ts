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
};

export type AuthConfig = {
  loginPassword: string;
};

export type Config = CassandraConfig & KafkaConfig & AuthConfig & { port: number };

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
  };
}

export function loadAuthConfig(): AuthConfig {
  return {
    loginPassword: process.env.LOGIN_PASSWORD || 'admin1234',
  };
}

export function loadConfig(): Config {
  return {
    port: int('PORT', process.env.PORT ?? '8080'),
    ...loadCassandraConfig(),
    ...loadKafkaConfig(),
    ...loadAuthConfig(),
  };
}
