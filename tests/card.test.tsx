import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Card } from "../src/components/ui/card";
import React from "react";

describe("Card", () => {
  it("renders card element", () => {
    const { container } = render(<Card>Card Content</Card>);
    expect(container.firstChild).toHaveTextContent("Card Content");
  });
});
