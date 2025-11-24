#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/.env.horsey"

RACE_ID="${1:?raceId required}"
RACER_INDEX="${2:?racerIndex required}"
AMOUNT_ETH="${3:?eth amount required}"
PK="${4:-$DEFAULT_PK}"

echo "Placing bet:"
echo "  Race ID     : $RACE_ID"
echo "  Racer Index : $RACER_INDEX"
echo "  Amount (ETH): $AMOUNT_ETH"

cast send "$CONTRACT" \
  'bet(uint256,uint8)' "$RACE_ID" "$RACER_INDEX" \
  --value "$(cast to-wei "$AMOUNT_ETH" ether)" \
  --private-key "$PK" --rpc-url "$RPC_URL"
