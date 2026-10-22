// Settings from the environment (set in docker-compose.yml). Missing values fail at startup.

export class ConfigError extends Error {}

export type Config = {
  port: number;
  contactPoints: string[];
  cassandraPort: number;
  localDc: string;
  keyspace: string;
};

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

export function loadConfig(): Config {
  return {
    port: int('PORT', process.env.PORT ?? '8080'),
    contactPoints: required('CASSANDRA_CONTACT_POINTS')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
    cassandraPort: int('CASSANDRA_PORT', required('CASSANDRA_PORT')),
    localDc: required('CASSANDRA_LOCAL_DC'),
    keyspace: required('CASSANDRA_KEYSPACE'),
  };
}
