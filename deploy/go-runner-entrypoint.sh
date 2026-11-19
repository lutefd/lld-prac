#!/bin/sh
set -eu

# Only links and newly compiled artifacts occupy the private, disposable tmpfs.
# Seed artifacts remain read-only in the image and cannot be changed by tests.
mkdir -p "$GOCACHE"
cp -as /opt/workbench/go-cache/. "$GOCACHE/"
exec "$@"
