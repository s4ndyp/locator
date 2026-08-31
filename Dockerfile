FROM alpine:latest

ARG PB_VERSION=0.40.1

RUN apk add --no-cache \
    ca-certificates \
    unzip \
    wget \
    zip

ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

COPY ./pb_public /pb/pb_public
COPY ./pb_migrations /pb/pb_migrations

WORKDIR /pb
VOLUME ["/pb/pb_data"]

EXPOSE 8080

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
