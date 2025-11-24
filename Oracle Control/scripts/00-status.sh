#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/.env.horsey"

RPC_URL="${RPC_URL:?RPC_URL missing in .env.horsey}"
CONTRACT="${CONTRACT:?CONTRACT missing in .env.horsey}"

fmt_time() { date -u -d "@$1" +'%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date -r "$1" -u '+%Y-%m-%d %H:%M:%S UTC'; }

get_race_json() {
  cast call "$CONTRACT" \
    'getRace(uint256)(string,string[],uint64,uint64,bool,uint8,uint256,uint256[],bool)' \
    "$1" --rpc-url "$RPC_URL" --json
}

# ---------- address list for "waiting to claim" ----------
# Priority:
# 1) CLAIM_ADDRS env (space-separated addresses)
# 2) Derive from DEFAULT_PKS (first 10 Anvil keys)
DEFAULT_PKS=(
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
  0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
  0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e
  0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356
  0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97
  0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
)

declare -a ADDRS
if [ -n "${CLAIM_ADDRS:-}" ]; then
  # use provided addresses
  read -r -a ADDRS <<< "$CLAIM_ADDRS"
else
  # derive from PKs
  for pk in "${DEFAULT_PKS[@]}"; do
    ADDRS+=( "$(cast wallet address --private-key "$pk")" )
  done
fi

# ---------- Active ----------
echo "🔹 Active Race IDs with lock times:"

ACTIVE_RAW="$(cast call "$CONTRACT" 'activeRaceIds()(uint256[])' --rpc-url "$RPC_URL" || echo '[]')"
ACTIVE_IDS="$(echo "$ACTIVE_RAW" | tr -d '[]' | tr ',' ' ' | xargs || true)"

if [ -z "$ACTIVE_IDS" ]; then
  echo "  (none)"
else
  for id in $ACTIVE_IDS; do
    race="$(get_race_json "$id" 2>/dev/null || echo '')"
    if [ -z "$race" ]; then
      echo "  - raceId=$id  (could not read getRace)"
      continue
    fi
    lockTime="$(echo "$race" | jq -r '.[3]')"
    settled="$(echo "$race" | jq -r '.[4]')"
    echo "  - raceId=$id   lockTime=$lockTime  ($(fmt_time "$lockTime"))  settled=$settled"
  done
fi

# ---------- Waiting for settlement ----------
echo ""
echo "🔸 Races Waiting for Settlement (lockTime passed but not settled):"

NEXT_ID_HEX="$(cast call "$CONTRACT" 'nextRaceId()(uint256)' --rpc-url "$RPC_URL" 2>/dev/null || echo 0x0)"
NEXT_ID="$(cast --to-dec "$NEXT_ID_HEX" 2>/dev/null || echo 0)"
if ! [[ "$NEXT_ID" =~ ^[0-9]+$ ]]; then NEXT_ID=0; fi

NOW="$(date +%s)"
found_any=0
for ((i=0; i<NEXT_ID; i++)); do
  race="$(get_race_json "$i" 2>/dev/null || echo '')"
  [ -z "$race" ] && continue
  racers_count="$(echo "$race" | jq -r '.[1] | length')"
  [ "$racers_count" -lt 3 ] && continue

  lockTime="$(echo "$race" | jq -r '.[3]')"
  settled="$(echo "$race" | jq -r '.[4]')"
  vrfRequested="$(echo "$race" | jq -r '.[8]')"

  if [ "$settled" = "false" ] && [ "$lockTime" -le "$NOW" ]; then
    found_any=1
    echo "  - raceId=$i  lockTime=$lockTime ($(fmt_time "$lockTime"))  vrfRequested=$vrfRequested"
  fi
done
[ "$found_any" -eq 0 ] && echo "  (none)"

# ---------- Waiting to claim ----------
echo ""
echo "🏁 Races Waiting to Claim (per configured accounts):"

claim_any=0
for ((i=0; i<NEXT_ID; i++)); do
  race="$(get_race_json "$i" 2>/dev/null || echo '')"
  [ -z "$race" ] && continue
  settled="$(echo "$race" | jq -r '.[4]')"
  [ "$settled" != "true" ] && continue

  # check each address
  row_printed=0
  for addr in "${ADDRS[@]}"; do
    # already claimed?
    CLAIMED=$(cast call "$CONTRACT" 'claimed(uint256,address)(bool)' "$i" "$addr" --rpc-url "$RPC_URL" 2>/dev/null || echo "false")
    if [ "$CLAIMED" = "true" ]; then
      continue
    fi
    # potential payout
    PAY_HEX=$(cast call "$CONTRACT" 'previewPayout(uint256,address)(uint256)' "$i" "$addr" --rpc-url "$RPC_URL" 2>/dev/null || echo "0x0")
    PAY_WEI=$(cast --to-dec "$PAY_HEX" 2>/dev/null || echo "0")
    if [ "$PAY_WEI" -gt 0 ]; then
      ETH=$(cast from-wei "$PAY_WEI" ether)
      if [ "$row_printed" -eq 0 ]; then
        echo "  - raceId=$i"
        row_printed=1
        claim_any=1
      fi
      echo "      • $addr — can claim ~${ETH} ETH"
    fi
  done
done
[ "$claim_any" -eq 0 ] && echo "  (none)"

echo ""
