FROM golang:1.26-alpine
# Build once into an immutable image layer, rather than during every submission.
ENV GOCACHE=/opt/workbench/go-cache \
    GOPROXY=off \
    GOTOOLCHAIN=local \
    CGO_ENABLED=0
# Prewarm testing and common stdlib packages rather than all of std, keeping
# the symlinked per-run cache small and fast to seed.
RUN go build testing fmt sort strings strconv slices maps errors math math/rand \
    sync sync/atomic time container/heap container/list bytes regexp unicode \
    reflect context encoding/json
COPY deploy/go-runner-entrypoint.sh /usr/local/bin/workbench-go-runner
ENV GOCACHE=/tmp/go-cache
ENTRYPOINT ["/usr/local/bin/workbench-go-runner"]
CMD ["go", "version"]
