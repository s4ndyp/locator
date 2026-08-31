FROM alpine:3.21

ARG PB_VERSION=0.40.1
ARG TARGETARCH

RUN apk add --no-cache ca-certificates tzdata unzip wget \
    && case "${TARGETARCH}" in \
        amd64) ARCH=amd64 ;; \
        arm64) ARCH=arm64 ;; \
        arm) ARCH=armv7 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
    esac \
    && wget -q -O /tmp/pb.zip \
        "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip" \
    && unzip /tmp/pb.zip -d /pb \
    && chmod +x /pb/pocketbase \
    && rm /tmp/pb.zip \
    && apk del wget unzip

WORKDIR /pb

EXPOSE 8090

VOLUME ["/pb/pb_data", "/pb/pb_public", "/pb/pb_migrations"]

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir", "/pb/pb_data", "--publicDir", "/pb/pb_public", "--migrationsDir", "/pb/pb_migrations"]
