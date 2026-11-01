export class ConfigError extends Error {}

export type Config = {
  port: number;
  kafkaBrokers: string[];
  decisionsTopic: string;
  alertsTopic: string;
  settlementsTopic: string;
  creditsTopic: string;
  postgresHost: string;
  postgresPort: number;
  postgresDb: string;
  postgresUser: string;
  postgresPassword: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new ConfigError(`${name} is not set`);
  return value;
}

function int(name: string, raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new ConfigError(`${name} must be a whole number, got '${raw}'`);
  return n;
}

export function loadConfig(): Config {
  return {
    port: int('PORT', process.env.PORT ?? '8081'),
    kafkaBrokers: required('KAFKA_BOOTSTRAP_SERVERS')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
    decisionsTopic: required('TOPIC_DECISIONS'),
    alertsTopic: required('TOPIC_ALERTS'),
    settlementsTopic: required('TOPIC_SETTLEMENTS'),
    creditsTopic: required('TOPIC_CREDITS'),
    postgresHost: required('POSTGRES_HOST'),
    postgresPort: int('POSTGRES_PORT', required('POSTGRES_PORT')),
    postgresDb: required('POSTGRES_DB'),
    postgresUser: required('POSTGRES_USER'),
    postgresPassword: required('POSTGRES_PASSWORD'),
  };
}
