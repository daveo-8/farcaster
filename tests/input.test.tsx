import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Input } from "../src/components/ui/input";
import React from "react";

describe("Input", () => {
  it("renders input element", () => {
    const { getByRole } = render(<Input />);
    expect(getByRole("textbox")).toBeInTheDocument();
  });
});
