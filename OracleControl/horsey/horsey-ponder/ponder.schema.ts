import { onchainTable } from "ponder";

export const bet = onchainTable("bet", (t) => ({
  id: t.text().primaryKey(), // shareId
  bettor: t.hex().notNull(),
  shareId: t.bigint().notNull(),
  raceIndex: t.bigint().notNull(),
  horse: t.integer().notNull(), // 0-7 enum value
  amount: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
  claimed: t.boolean().notNull().default(false), // Track if share has been claimed
}));

export const race = onchainTable("race", (t) => ({
  id: t.text().primaryKey(), // raceIndex as string
  raceIndex: t.bigint().notNull(),
  startBlock: t.bigint(),
  endBlock: t.bigint(),
  requestedBlock: t.bigint(),
  sequenceNumber: t.bigint(),
  winner: t.integer(), // 0-7 enum value (nullable until resolved)
  resolvedTimestamp: t.bigint(),
  resolvedBlockNumber: t.bigint(),
  resolvedTransactionHash: t.hex(),
}));
