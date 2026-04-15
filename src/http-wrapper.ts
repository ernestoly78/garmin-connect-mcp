import express from "express";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

// 🧠 control global
let lastCallTime = 0;
const MIN_INTERVAL = 3000; // 3 segundos

// 🔥 cache simple
let lastResponse: any = null;
let lastResponseTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minuto

app.post("/mcp", async (req, res) => {
  try {
    console.log("\n================ MCP REQUEST ================");
    console.log("📥 BODY:", JSON.stringify(req.body, null, 2));

    const now = Date.now();

    // 🧠 RATE LIMIT GLOBAL
    if (now - lastCallTime < MIN_INTERVAL) {
      console.log("⛔ BLOCKED BY RATE LIMIT");

      if (lastResponse) {
        console.log("⚡ RETURNING CACHED RESPONSE");
        return res.json(lastResponse);
      }

      return res.status(429).json({
        error: "rate_limited_wrapper"
      });
    }

    // 🧠 CACHE
    if (lastResponse && now - lastResponseTime < CACHE_TTL) {
      console.log("⚡ USING WRAPPER CACHE");
      return res.json(lastResponse);
    }

    lastCallTime = now;

    console.log("🚀 SPAWNING MCP PROCESS");

    const mcp = spawn("node", ["dist/index.cjs"]);

    let output = "";
    let error = "";

    mcp.stdout.on("data", (data) => {
      const chunk = data.toString();
      console.log("📤 MCP STDOUT:", chunk);
      output += chunk;
    });

    mcp.stderr.on("data", (data) => {
      const chunk = data.toString();
      console.error("❌ MCP STDERR:", chunk);
      error += chunk;
    });

    mcp.on("close", () => {
      console.log("🔚 MCP PROCESS CLOSED");

      try {
        const parsed = JSON.parse(output);

        console.log("✅ PARSED MCP RESPONSE");

        // 🧠 detectar 429 dentro del MCP
        const text = parsed?.content?.[0]?.text;

        if (text && text.includes("429")) {
          console.log("🚨 GARMIN 429 DETECTED");

          if (lastResponse) {
            console.log("⚡ USING PREVIOUS RESPONSE");
            return res.json(lastResponse);
          }

          return res.json({
            error: "garmin_rate_limit"
          });
        }

        // 🔥 guardar cache
        lastResponse = parsed;
        lastResponseTime = Date.now();

        res.json(parsed);

      } catch (e) {
        console.error("❌ PARSE ERROR:", output);

        res.status(500).json({
          error: "invalid_mcp_response",
          raw: output
        });
      }
    });

    // 🔥 enviar request al MCP
    mcp.stdin.write(JSON.stringify(req.body) + "\n");
    mcp.stdin.end();

  } catch (e: any) {
    console.error("❌ WRAPPER ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (_, res) => {
  res.send("MCP HTTP wrapper alive 🧠");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 MCP HTTP wrapper running");
});
