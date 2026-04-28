export function attachTunnelUrlExtractor(child, kind, onUrl) {
  const pipe = (stream) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const match = line.match(/https:\/\/[a-z0-9.-]+\.trycloudflare\.com/i);
        if (!match) continue;
        onUrl(kind, match[0]);
      }
    });
  };

  pipe(child.stdout);
  pipe(child.stderr);
}
