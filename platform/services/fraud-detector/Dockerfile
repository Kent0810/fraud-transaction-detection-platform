FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /build
COPY pom.xml ./

# install all dependencies
RUN mvn -q dependency:go-offline 

COPY src/ ./src/

RUN mvn -q -o package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /build/target/fraud-detector.jar ./

ENTRYPOINT ["java", "-jar", "fraud-detector.jar"]
