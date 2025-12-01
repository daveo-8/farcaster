import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "../src/components/ui/badge";
import React from "react";

describe("Badge", () => {
  it("renders badge", () => {
    const { container } = render(<Badge>Badge</Badge>);
    expect(container.firstChild).toHaveTextContent("Badge");
  });
});
