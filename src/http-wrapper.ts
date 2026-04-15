import express from "express";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

// ===============================
// 🧠 MCP PERSISTENTE
// ===============================
let mcp: ReturnType<typeof spawn> | null = null;

// respuestas pendientes
const pending = new Map<number, (payload: any) => void>();

// buffer de salida
let stdoutBuffer = "";

// 🔇 FILTRO DE LOGS (CLAVE)
function isNoise(line: string) {
  return (
    line.includes('"tools"') || // lista de tools
    line.includes("register") ||
    line.includes("schema") ||
    line.length > 2000 // payloads gigantes
  );
}

// iniciar MCP una vez
function startMcp() {
  console.log("🚀 Starting MCP (silent mode)");

  mcp = spawn("node", ["dist/index.cjs"]);

  mcp.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdoutBuffer += text;

    let lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line);

        // 👉 solo procesamos respuestas reales
        if (msg.id && pending.has(msg.id)) {
          const resolve = pending.get(msg.id)!;
          pending.delete(msg.id);
          resolve(msg);
        } else {
          // 🔇 ignoramos ruido
          if (!isNoise(line)) {
            console.log("📤 MCP:", line);
          }
        }
      } catch {
        // 🔇 ignorar líneas no JSON (boot logs)
      }
    }
  });

  mcp.stderr.on("data", (data: Buffer) => {
    const txt = data.toString();

    // 👉 SOLO logs importantes
    if (txt.includes("Authenticating")) {
      console.log("🔐 Garmin login...");
    } else if (txt.toLowerCase().includes("error")) {
      console.error("❌ MCP:", txt);
    }
    // 🔇 todo lo demás se ignora
  });

  mcp.on("close", () => {
    console.error("💀 MCP closed, restarting...");
    mcp = null;
    setTimeout(startMcp, 2000);
  });
}

startMcp();

// ===============================
// 🧠 CONTROL DE LLAMADAS
// ===============================
let lastCallTime = 0;
const MIN_INTERVAL = 1500;

let lastResponse: any = null;
let lastResponseTime = 0;
const CACHE_TTL = 60000;

// ===============================
// 🔌 ENDPOINT MCP
// ===============================
app.post("/mcp", async (req, res) => {
  try {
    const now = Date.now();

    // rate limit
    if (now - lastCallTime < MIN_INTERVAL) {
      if (lastResponse) {
        return res.json(lastResponse);
      }
      return res.status(429).json({ error: "rate_limited" });
    }

    // cache
    if (lastResponse && now - lastResponseTime < CACHE_TTL) {
      return res.json(lastResponse);
    }

    lastCallTime = now;

    if (!mcp) {
      return res.status(500).json({ error: "mcp_not_running" });
    }

    const id = req.body.id ?? Math.floor(Math.random() * 1e9);

    const payload = {
      ...req.body,
      id
    };

    const responsePromise = new Promise((resolve, reject) => {
      pending.set(id, resolve);

      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("timeout"));
        }
      }, 15000);
    });

    mcp.stdin.write(JSON.stringify(payload) + "\n");

    const result: any = await responsePromise;

    const text = result?.result?.content?.[0]?.text;

    // detectar 429
    if (text && text.includes("429")) {
      console.log("🚨 Garmin rate limited");

      if (lastResponse) {
        return res.json(lastResponse);
      }

      return res.json({ error: "garmin_rate_limit" });
    }

    lastResponse = result;
    lastResponseTime = Date.now();

    res.json(result);

  } catch (e: any) {
    console.error("❌ wrapper error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// health
app.get("/", (_, res) => {
  res.send("MCP wrapper running 🧠");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 HTTP wrapper ready");
});
