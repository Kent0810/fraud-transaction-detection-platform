package cardfraud;

import org.apache.kafka.common.serialization.Deserializer;
import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.serialization.Serializer;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;

// JSON <-> Java record. Fields are snake_case on the wire (cc_num), camelCase in Java (ccNum).
final class JsonSerde {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private JsonSerde() {
    }

    static <T> Serde<T> of(Class<T> type) {
        Serializer<T> serializer = (topic, value) -> {
            // TODO object -> bytes: MAPPER.writeValueAsBytes(value).
            //   Return null for a null value (a delete / tombstone on compacted topics).
            //   Wrap checked exceptions in org.apache.kafka.common.errors.SerializationException.
            throw new UnsupportedOperationException("TODO serialize");
        };
        Deserializer<T> deserializer = (topic, bytes) -> {
            // TODO bytes -> object: MAPPER.readValue(bytes, type). Same null and exception rules.
            throw new UnsupportedOperationException("TODO deserialize");
        };
        return Serdes.serdeFrom(serializer, deserializer);
    }
}
