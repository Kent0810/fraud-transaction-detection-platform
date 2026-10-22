FROM quay.io/debezium/connect:3.6.2.Final

ARG CASSANDRA_SINK_VERSION=1.7.6
ARG CASSANDRA_SINK_SHA256=83db4a8b7edbd73c4cd17c151718c88a5dc33e34d90f1ed80e7f632d75dc8d25

# The worker loads every folder under /kafka/connect (its plugin.path) as one plugin.
# --checksum fails the build if the downloaded jar isn't exactly the release we pinned.
ADD --chown=kafka:kafka --checksum=sha256:${CASSANDRA_SINK_SHA256} \
    https://github.com/datastax/kafka-sink/releases/download/${CASSANDRA_SINK_VERSION}/kafka-connect-cassandra-sink-${CASSANDRA_SINK_VERSION}.jar \
    /kafka/connect/cassandra-sink/
