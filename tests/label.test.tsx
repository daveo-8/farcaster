import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Label } from "../src/components/ui/label";
import React from "react";

describe("Label", () => {
  it("renders label", () => {
    const { getByText } = render(<Label>Label Text</Label>);
    expect(getByText("Label Text")).toBeInTheDocument();
  });
});
