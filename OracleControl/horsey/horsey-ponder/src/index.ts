import { ponder } from "ponder:registry";
import { bet, race } from "../ponder.schema";

// Index RaceStarted events - creates race records
ponder.on("Horsey:RaceStarted", async ({ event, context }) => {
  await context.db.insert(race).values({
    id: event.args.raceIndex.toString(),
    raceIndex: event.args.raceIndex,
    startBlock: event.args.startBlock,
    endBlock: event.args.endBlock,
  });
});

// Index BetPlaced events
ponder.on("Horsey:BetPlaced", async ({ event, context }) => {
  await context.db.insert(bet).values({
    id: event.args.shareId.toString(),
    bettor: event.args.bettor,
    shareId: event.args.shareId,
    raceIndex: event.args.raceIndex,
    horse: Number(event.args.horse),
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// Index RaceRequested events - updates race with entropy request info
ponder.on("Horsey:RaceRequested", async ({ event, context }) => {
  await context.db
    .update(race, { id: event.args.raceIndex.toString() })
    .set({
      requestedBlock: event.block.number,
      sequenceNumber: event.args.sequenceNumber,
    });
});

// Index RaceResolved events - updates race with winner
ponder.on("Horsey:RaceResolved", async ({ event, context }) => {
  await context.db
    .update(race, { id: event.args.raceIndex.toString() })
    .set({
      winner: Number(event.args.winner),
      resolvedTimestamp: event.block.timestamp,
      resolvedBlockNumber: event.block.number,
      resolvedTransactionHash: event.transaction.hash,
    });
});
