import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./csp";

describe("buildContentSecurityPolicy", () => {
  it("disallows inline scripts and remote/ws connect in production", () => {
    const prod = buildContentSecurityPolicy(false);
    expect(prod).toContain("script-src 'self';");
    expect(prod).toContain("style-src 'self' 'unsafe-inline'");
    expect(prod).toContain("connect-src 'self';");
    expect(prod).not.toContain("ws:");
    expect(prod).toContain("worker-src 'self' blob:");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("frame-src 'none'");
  });

  it("allows inline scripts and HMR websockets in dev", () => {
    const dev = buildContentSecurityPolicy(true);
    expect(dev).toContain("script-src 'self' 'unsafe-inline'");
    expect(dev).toContain("connect-src 'self' ws: wss:");
  });
});
