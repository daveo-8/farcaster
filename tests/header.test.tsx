import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "../src/components/ui/Header";
import "@testing-library/jest-dom";
import React from "react";

// Mock dependencies
vi.mock("@neynar/react", () => ({ useMiniApp: () => ({ context: {} }) }));
vi.mock("~/lib/wallet-context", () => ({ useWallet: () => ({ balance: 1234 }) }));
vi.mock("lucide-react", () => ({ Trophy: (props: any) => <svg data-testid="trophy" {...props} /> }));

describe("Header", () => {
	it("renders app name and tagline", () => {
		render(<Header neynarUser={null} />);
		expect(screen.getByText("Farbets")).toBeInTheDocument();
		expect(screen.getByText("Place your bets, win big")).toBeInTheDocument();
	});

	it("renders coin balance", () => {
		render(<Header neynarUser={null} />);
		expect(screen.getByText("1,234")).toBeInTheDocument();
		expect(screen.getByText("coins")).toBeInTheDocument();
	});

	it("renders trophy icon", () => {
		render(<Header neynarUser={null} />);
		expect(screen.getByTestId("trophy")).toBeInTheDocument();
	});
});
