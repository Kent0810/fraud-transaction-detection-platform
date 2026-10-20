package cardfraud;

import java.util.Properties;

import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.StreamsConfig;

record Config(
        String bootstrap,
        String applicationId,
        String processingGuarantee,
        long commitIntervalMs,
        int numStandbyReplicas,
        String stateDir,
        String transactionsTopic,
        long logEvery) {

    static class ConfigException extends RuntimeException {
        ConfigException(String message) {
            super(message);
        }
    }

    static Config fromEnv() {
        long logEvery = parseLong("LOG_EVERY");
        if (logEvery <= 0) {
            throw new ConfigException("LOG_EVERY must be greater than 0, got " + logEvery);
        }

        return new Config(
                require("KAFKA_BOOTSTRAP_SERVERS"),
                require("APPLICATION_ID"),
                require("PROCESSING_GUARANTEE"),
                parseLong("COMMIT_INTERVAL_MS"),
                (int) parseLong("NUM_STANDBY_REPLICAS"),
                require("STATE_DIR"),
                require("TOPIC_TRANSACTIONS"),
                logEvery);
    }

    Properties toStreamsProperties() {
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, this.applicationId);
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, this.bootstrap);
        props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, this.processingGuarantee);
        props.put(StreamsConfig.COMMIT_INTERVAL_MS_CONFIG, this.commitIntervalMs);
        props.put(StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG, this.numStandbyReplicas);
        props.put(StreamsConfig.STATE_DIR_CONFIG, this.stateDir);
        // key = card number, value = the event as JSON text
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.StringSerde.class);
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.StringSerde.class);
        return props;
    }

    private static String require(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new ConfigException(name + " is not set");
        }
        return value;
    }

    private static long parseLong(String name) {
        String raw = require(name);
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            throw new ConfigException(name + " must be a whole number, got '" + raw + "'");
        }
    }
}
