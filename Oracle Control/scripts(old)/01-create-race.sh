#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/.env.horsey"

NAME="${1:-Saturday Sprint}"
RACERS_JSON="${2:-$DEFAULT_RACERS}"
LOCK_OFFSET="${3:-+600}"  # e.g. +600 = lock in 10 minutes

# Compute times (seconds since epoch)
NOW=$(date +%s)
if [[ "$LOCK_OFFSET" =~ ^\+?[0-9]+$ ]]; then
  LOCK_TIME=$(( NOW + ${LOCK_OFFSET#\+} ))
else
  echo "LOCK_OFFSET must be seconds from now (e.g. +900)"; exit 1
fi
START_TIME="$NOW"

echo "Creating race:"
echo "  Name        : $NAME"
echo "  Racers      : $RACERS_JSON"
echo "  StartTime   : $START_TIME"
echo "  LockTime    : $LOCK_TIME"

cast send "$CONTRACT" \
  'createRace(string,string[],uint64,uint64)' \
  "$NAME" "$RACERS_JSON" "$START_TIME" "$LOCK_TIME" \
  --private-key "$DEFAULT_PK" --rpc-url "$RPC_URL"
