import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { waitForTunnelUrl } from "../scripts/dev/tunnels.mjs";

class TunnelProcessStub extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

test("resolves the first Cloudflare tunnel URL and removes listeners", async () => {
  const child = new TunnelProcessStub();
  const result = waitForTunnelUrl(child, "api", { timeoutMs: 100 });

  child.stderr.emit(
    "data",
    Buffer.from(
      "2026-07-21 INF Your quick Tunnel has been created https://local-api.trycloudflare.com\n",
    ),
  );

  assert.equal(await result, "https://local-api.trycloudflare.com");
  assert.equal(child.stdout.listenerCount("data"), 0);
  assert.equal(child.stderr.listenerCount("data"), 0);
  assert.equal(child.listenerCount("exit"), 0);
});

test("rejects when the tunnel exits before publishing a URL", async () => {
  const child = new TunnelProcessStub();
  const result = waitForTunnelUrl(child, "frontend", { timeoutMs: 100 });

  child.emit("exit", 1);

  await assert.rejects(
    result,
    /frontend tunnel exited before publishing a URL \(code 1\)/,
  );
});

test("rejects when the tunnel URL is not published before the timeout", async () => {
  const child = new TunnelProcessStub();

  await assert.rejects(
    waitForTunnelUrl(child, "api", { timeoutMs: 5 }),
    /api tunnel did not publish a URL within 5ms/,
  );
});
