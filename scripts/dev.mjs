import net from "node:net";
import { spawn } from "node:child_process";

const preferredPorts = [5000, 5001, 5002, 4321];

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1" }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort() {
  for (const port of preferredPorts) {
    // eslint-disable-next-line no-await-in-loop
    if (await canListen(port)) return port;
  }
  return 0;
}

const port = process.env.PORT ? Number(process.env.PORT) : await pickPort();

if (!Number.isFinite(port) || port <= 0) {
  console.error("No available port found.");
  process.exit(1);
}

console.log(`[dev] Starting Astro on http://localhost:${port}/`);
if (port !== 5000) {
  console.log(
    `[dev] Note: port 5000 is in use on this machine. Using ${port} instead.`
  );
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["astro", "dev", "--port", String(port), "--host", "127.0.0.1"],
  { stdio: "inherit" }
);

child.on("exit", (code) => process.exit(code ?? 0));

