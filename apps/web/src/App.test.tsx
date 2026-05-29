import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

function renderApp() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App home", () => {
  it("renders the home screen with both modes", () => {
    renderApp();
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText("Arena")).toBeInTheDocument();
    expect(screen.getByText("Choose difficulty")).toBeInTheDocument();
  });
});
