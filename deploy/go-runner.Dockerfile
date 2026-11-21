FROM golang:1.26-alpine
# Build once into an immutable image layer, rather than during every submission.
ENV GOCACHE=/opt/workbench/go-cache \
    GOPROXY=off \
    GOTOOLCHAIN=local \
    CGO_ENABLED=0
# Prewarm the test cache via an actual `go test` using the same go.mod version
# as the exercises so `testing/internal/testdeps` and all transitive test
# packages hit the cache (dropping per-run compiles from ~53 to 2).
RUN mkdir -p /tmp/warmup \
    && printf 'module warmup\n\ngo 1.22\n' > /tmp/warmup/go.mod \
    && printf '%s\n' \
        'package warmup' \
        'import (' \
        '  _ "bytes"' \
        '  _ "container/heap"' \
        '  _ "container/list"' \
        '  _ "context"' \
        '  _ "encoding/json"' \
        '  _ "errors"' \
        '  _ "fmt"' \
        '  _ "maps"' \
        '  _ "math"' \
        '  _ "math/rand"' \
        '  _ "reflect"' \
        '  _ "regexp"' \
        '  _ "slices"' \
        '  _ "sort"' \
        '  _ "strconv"' \
        '  _ "strings"' \
        '  _ "sync"' \
        '  _ "sync/atomic"' \
        '  "testing"' \
        '  _ "time"' \
        '  _ "unicode"' \
        ')' \
        'func TestWarmup(t *testing.T) {}' \
        > /tmp/warmup/warmup_test.go \
    && (cd /tmp/warmup && go test -count=1 .) \
    && rm -rf /tmp/warmup
COPY deploy/go-runner-entrypoint.sh /usr/local/bin/workbench-go-runner
ENV GOCACHE=/tmp/go-cache
ENTRYPOINT ["/usr/local/bin/workbench-go-runner"]
CMD ["go", "version"]
