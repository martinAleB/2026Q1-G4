FROM public.ecr.aws/lambda/python:3.12

RUN dnf install -y java-21-amazon-corretto-headless tar gzip

ARG FLYWAY_VERSION=10.15.0
RUN curl -sL "https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/${FLYWAY_VERSION}/flyway-commandline-${FLYWAY_VERSION}-linux-x64.tar.gz" \
    | tar xz -C /opt \
    && chmod +x /opt/flyway-${FLYWAY_VERSION}/flyway \
    && ln -s /opt/flyway-${FLYWAY_VERSION}/flyway /usr/local/bin/flyway

COPY migrations/ /var/task/migrations/
COPY handler.py  /var/task/

CMD ["handler.handler"]
