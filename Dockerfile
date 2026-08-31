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

COPY pb_public/ /pb/pb_public/
COPY pb_migrations/ /pb/pb_migrations/

# Fail the build if static files or migrations were not copied
RUN test -f /pb/pb_public/index.html \
    && test -f /pb/pb_public/js/app.js \
    && ls /pb/pb_migrations/*.js >/dev/null 2>&1

WORKDIR /pb

EXPOSE 8090

VOLUME ["/pb/pb_data"]

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir", "/pb/pb_data", "--publicDir", "/pb/pb_public", "--migrationsDir", "/pb/pb_migrations", "--indexFallback=true"]
