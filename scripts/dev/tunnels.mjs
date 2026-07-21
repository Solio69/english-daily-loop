export function attachTunnelUrlExtractor(child, kind, onUrl) {
  const listeners = [];

  const pipe = (stream) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const match = line.match(/https:\/\/[a-z0-9.-]+\.trycloudflare\.com/i);
        if (!match) continue;
        onUrl(kind, match[0]);
      }
    };

    stream.on("data", onData);
    listeners.push(() => stream.off("data", onData));
  };

  pipe(child.stdout);
  pipe(child.stderr);

  return () => {
    for (const removeListener of listeners) {
      removeListener();
    }
  };
}

export function waitForTunnelUrl(child, kind, { timeoutMs = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let removeExtractor = () => {};

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      removeExtractor();
      child.off("exit", onExit);
      callback(value);
    };

    const onExit = (code) => {
      finish(
        reject,
        new Error(
          `${kind} tunnel exited before publishing a URL (code ${code ?? "unknown"}).`,
        ),
      );
    };

    const timeout = setTimeout(() => {
      finish(
        reject,
        new Error(`${kind} tunnel did not publish a URL within ${timeoutMs}ms.`),
      );
    }, timeoutMs);

    removeExtractor = attachTunnelUrlExtractor(child, kind, (_kind, url) => {
      finish(resolve, url);
    });
    child.once("exit", onExit);
  });
}
