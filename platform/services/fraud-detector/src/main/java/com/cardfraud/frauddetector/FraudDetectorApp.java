package com.cardfraud.frauddetector;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;

import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.errors.StreamsUncaughtExceptionHandler.StreamThreadExceptionResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.cardfraud.frauddetector.config.Config;
import com.cardfraud.frauddetector.topology.FraudTopology;

// Entry point: reads config, runs the topology, and handles failure and shutdown.
public class FraudDetectorApp {
    private static final Logger log = LoggerFactory.getLogger("fraud-detector");

    public static void main(String[] args) {
        Config cfg;
        try {
            cfg = Config.fromEnv();
        } catch (Config.ConfigException e) {
            log.error("config error: {}", e.getMessage());
            System.exit(1);
            return;
        }

        KafkaStreams streams = new KafkaStreams(FraudTopology.build(cfg), cfg.toStreamsProperties());
        CountDownLatch streamsStopped = new CountDownLatch(1);

        AtomicBoolean failed = new AtomicBoolean(false);

        // A failed stream thread stops the whole app, so `restart: on-failure` starts it again.
        streams.setUncaughtExceptionHandler(exception -> {
            log.error("stream thread failed", exception);
            failed.set(true);
            
            return StreamThreadExceptionResponse.SHUTDOWN_CLIENT;
        });

        streams.setStateListener((newState, oldState) -> {
            log.info("state {} -> {}", oldState, newState);
            if (newState == KafkaStreams.State.ERROR || newState == KafkaStreams.State.NOT_RUNNING) {
                streamsStopped.countDown();
            }
        });

        // SIGTERM from `docker compose stop`: commit and leave the group cleanly.
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            log.info("stopping");
            streams.close(Duration.ofSeconds(30));
        }, "shutdown"));

        log.info("start reading {} (application id {}, bootstrap {}, {})",
                cfg.transactionsTopic(), cfg.applicationId(), cfg.bootstrap(), cfg.processingGuarantee());
        
        // Let's GO!
        streams.start();

        try {
            streamsStopped.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        if (failed.get()) {
            System.exit(1);
        }
    }
}
