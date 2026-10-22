package com.cardfraud.frauddetector.serde;

import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.serialization.Deserializer;
import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.serialization.Serializer;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;

public final class JsonSerde {
    // static final = 1 instance for the whole app, created once.
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    // private constructor
    private JsonSerde() {
    }

    public static <T> Serde<T> of(Class<T> type) {
        Serializer<T> serializer = (topic, value) -> {
            if (value == null) {
                return null;
            }
            
            try {
                return MAPPER.writeValueAsBytes(value);
            } catch(Exception e) {
                throw new SerializationException("cannot write " + type.getSimpleName() + " to " + topic, e);
            }
        };

        Deserializer<T> deserializer = (topic, bytes) -> {
            if (bytes == null) {
                return null;
            }
            
            try {
                return MAPPER.readValue(bytes, type);
            } catch(Exception e) {
                throw new SerializationException("cannot read " + type.getSimpleName() + " from " + topic, e);
            }
        };

        return Serdes.serdeFrom(serializer, deserializer);
    }
}
