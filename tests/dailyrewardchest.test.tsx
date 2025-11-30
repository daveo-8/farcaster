import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DailyRewardChest from "../src/components/ui/dailyrewardchest";
import "@testing-library/jest-dom";
import React from "react";

const LS_KEY = "dailyRewardLastClaim";

describe("DailyRewardChest", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	it("shows ready to claim when available", () => {
		render(<DailyRewardChest rewardAmount={100} />);
		expect(screen.getByText("Ready to claim")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /claim daily reward/i })).not.toBeDisabled();
	});

	it("shows cooldown when not available", () => {
		// Set last claim to now
		localStorage.setItem(LS_KEY, String(Date.now()));
		render(<DailyRewardChest rewardAmount={100} />);
		expect(screen.getByText(/Next in/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /daily reward on cooldown/i })).toBeDisabled();
	});

	it("calls onClaim when claimed", () => {
		const onClaim = vi.fn();
		render(<DailyRewardChest rewardAmount={200} onClaim={onClaim} />);
		const btn = screen.getByRole("button", { name: /claim daily reward/i });
		fireEvent.click(btn);
		expect(onClaim).toHaveBeenCalledWith(200);
		// Button should now be disabled
		expect(btn).toBeDisabled();
	});

	it("shows correct accent color", () => {
		render(<DailyRewardChest accent="#ff0000" />);
		const chest = screen.getByRole("button");
		expect(chest).toHaveStyle({ borderColor: "#ff0000" });
	});
});
