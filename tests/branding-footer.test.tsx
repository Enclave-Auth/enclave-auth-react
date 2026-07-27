import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { SignIn } from "../src/components/SignIn.js";
import { renderWithAuth } from "./helpers/render.js";

vi.mock("@enclave-technologies/auth-sdk", () => ({
  initCrypto: vi.fn(async () => {}),
}));

describe("PoweredBy footer", () => {
  it("always shows on free plan regardless of appearance prop", async () => {
    renderWithAuth(
      <SignIn appearance={{ showPoweredBy: false }} />,
      { brandingRemovable: false },
    );

    await waitFor(() => {
      expect(screen.getByText(/powered by/i)).toBeInTheDocument();
    });
  });

  it("can hide when brandingRemovable is true and appearance allows", async () => {
    renderWithAuth(
      <SignIn appearance={{ showPoweredBy: false }} />,
      { brandingRemovable: true },
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/powered by/i)).not.toBeInTheDocument();
  });

  it("shows by default on paid plan", async () => {
    renderWithAuth(<SignIn />, { brandingRemovable: true });

    await waitFor(() => {
      expect(screen.getByText(/powered by/i)).toBeInTheDocument();
    });
  });
});
