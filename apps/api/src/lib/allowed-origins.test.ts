import { describe, expect, it } from "vitest";
import { getAllowedOrigins, isAllowedOrigin } from "./allowed-origins";

describe("API allowed origins", () => {
  it("allows production BISO origins in production", () => {
    expect(isAllowedOrigin("https://biso.no", "production")).toBe(true);
    expect(isAllowedOrigin("https://admin.biso.no", "production")).toBe(true);
  });

  it("rejects localhost origins in production", () => {
    expect(isAllowedOrigin("http://localhost:3000", "production")).toBe(false);
    expect(isAllowedOrigin("http://localhost:3001", "production")).toBe(false);
    expect(isAllowedOrigin("http://localhost:3002", "production")).toBe(false);
  });

  it("allows localhost origins outside production", () => {
    expect(isAllowedOrigin("http://localhost:3000", "development")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3001", "test")).toBe(true);
  });

  it("does not mutate the base origin set across calls", () => {
    getAllowedOrigins("development");

    expect(getAllowedOrigins("production").has("http://localhost:3000")).toBe(
      false
    );
  });
});
