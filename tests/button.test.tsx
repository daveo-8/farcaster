import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "../src/components/ui/button";
import "@testing-library/jest-dom";
import React from "react";

describe("Button", () => {
	it("renders with default props", () => {
		const { getByRole } = render(<Button>Click me</Button>);
		const button = getByRole("button");
		expect(button).toBeDefined();
		expect(button).toHaveTextContent("Click me");
	});

	it("applies variant and size classes", () => {
		const { getByRole } = render(
			<Button variant="destructive" size="lg">Delete</Button>
		);
		const button = getByRole("button");
		expect(button.className).toContain("bg-destructive");
		expect(button.className).toContain("h-11");
	});

	it("renders as child when asChild is true", () => {
		const { getByText } = render(
			<Button asChild>
				<a href="#">Link</a>
			</Button>
		);
		const link = getByText("Link");
		expect(link.tagName).toBe("A");
	});

	it("forwards additional props", () => {
		const { getByRole } = render(
			<Button aria-label="custom-label">Label</Button>
		);
		const button = getByRole("button");
		expect(button).toHaveAttribute("aria-label", "custom-label");
	});
});
