FROM golang:1.26-alpine
# Build once into an immutable image layer, rather than during every submission.
ENV GOCACHE=/opt/workbench/go-cache \
    GOPROXY=off \
    GOTOOLCHAIN=local \
    CGO_ENABLED=0
RUN go build std
COPY deploy/go-runner-entrypoint.sh /usr/local/bin/workbench-go-runner
ENV GOCACHE=/tmp/go-cache
ENTRYPOINT ["/usr/local/bin/workbench-go-runner"]
CMD ["go", "version"]
