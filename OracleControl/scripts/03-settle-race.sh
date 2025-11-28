#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/.env.horsey"

RACE_ID="${1:?raceId required}"
RANDOM_WORD="${2:-}"

# event SettlementRequested(uint256 indexed raceId, uint256 requestId)
EVENT_SIG='SettlementRequested(uint256,uint256)'

ensure_random_word() {
  if [ -z "$RANDOM_WORD" ]; then
    RANDOM_WORD="$(od -vAn -N8 -tu8 < /dev/urandom | tr -d ' ')"
  fi
}

get_latest_request_id_for_race() {
  # Use positional args: [SIG] [indexed-arg1] ...  (no --topics)
  # We filter by raceId (indexed) and read requestId from 'data'
  local json
  if ! json="$(cast logs \
      --rpc-url "$RPC_URL" \
      --address "$CONTRACT" \
      --from-block 0 --to-block latest \
      "$EVENT_SIG" "$RACE_ID" \
      --json 2>/dev/null)"; then
    echo ""
    return 0
  fi

  # Take the last log and decode requestId from .data (abi-encoded uint256)
  local data_hex
  data_hex="$(echo "$json" | jq -r '.[-1].data // empty')"
  if [ -z "$data_hex" ] || [ "$data_hex" = "null" ]; then
    echo ""
    return 0
  fi
  cast to-dec "$data_hex"
}

fulfill_with_request_id() {
  local req_id_dec="$1"
  ensure_random_word
  echo "  requestId : $req_id_dec"
  echo "  randomWord: $RANDOM_WORD"

  echo "Impersonating VRF coordinator… ($VRF_COORDINATOR)"
  cast rpc anvil_impersonateAccount "$VRF_COORDINATOR" >/dev/null
  cast rpc anvil_setBalance "$VRF_COORDINATOR" 0x56BC75E2D63100000 >/dev/null # 100 ETH

  # ✅ Use Anvil's unlocked signer (no PK) for the impersonated address
  ETH_FROM="$VRF_COORDINATOR" cast send "$CONTRACT" \
    'rawFulfillRandomWords(uint256,uint256[])' "$req_id_dec" "[$RANDOM_WORD]" \
    --unlocked --rpc-url "$RPC_URL"

  cast rpc anvil_stopImpersonatingAccount "$VRF_COORDINATOR" >/dev/null
  echo "✅ Race $RACE_ID settled!"
}


echo "Requesting settlement for race $RACE_ID (if needed)…"
set +e
REQ_TX_JSON="$(cast send "$CONTRACT" \
  'requestSettle(uint256)' "$RACE_ID" \
  --private-key "$DEFAULT_PK" --rpc-url "$RPC_URL" --json 2>&1)"
STATUS=$?
set -e

if [ $STATUS -eq 0 ]; then
  # Request succeeded → extract requestId from the tx receipt’s log
  TX_HASH="$(echo "$REQ_TX_JSON" | jq -r '.transactionHash')"
  echo "  request tx: $TX_HASH"
  RCPT_JSON="$(cast receipt "$TX_HASH" --rpc-url "$RPC_URL" --json)"
  DATA_HEX="$(echo "$RCPT_JSON" \
    | jq -r --arg sig "$EVENT_SIG" --arg rid "$RACE_ID" '
        .logs[]
        | select((.decoded["event"]? // "") == $sig and (.decoded["args"]["raceId"]? | tostring) == $rid)
        | .data
      ' )"

  # Fallback: match by topics if .decoded isn’t present in your cast
  if [ -z "$DATA_HEX" ] || [ "$DATA_HEX" = "null" ]; then
    TOPIC0="$(cast keccak "$EVENT_SIG")"
    RACE_TOPIC=$(printf "0x%064x" "$RACE_ID")
    DATA_HEX="$(echo "$RCPT_JSON" \
      | jq -r --arg t0 "$TOPIC0" --arg rt "$RACE_TOPIC" '
          .logs[]
          | select(.topics[0]==$t0 and .topics[1]==$rt)
          | .data
        ')"
  fi

  if [ -z "$DATA_HEX" ] || [ "$DATA_HEX" = "null" ]; then
    echo "❌ Could not find SettlementRequested log in receipt."
    exit 1
  fi

  REQ_ID_DEC="$(cast to-dec "$DATA_HEX")"
  fulfill_with_request_id "$REQ_ID_DEC"

else
  # Likely "already requested" → look up latest requestId from historical logs
  if echo "$REQ_TX_JSON" | grep -qi "already requested"; then
    echo "  already requested — locating existing requestId from logs…"
    REQ_ID_DEC="$(get_latest_request_id_for_race)"
    if [ -z "$REQ_ID_DEC" ]; then
      echo "❌ Could not find a SettlementRequested log for race $RACE_ID."
      echo "   Tip: ensure your CONTRACT & VRF_COORDINATOR are correct in .env.horsey"
      exit 1
    fi
    fulfill_with_request_id "$REQ_ID_DEC"
  else
    echo "❌ requestSettle reverted with an unexpected error:"
    echo "$REQ_TX_JSON"
    exit 1
  fi
fi
