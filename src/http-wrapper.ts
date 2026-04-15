import express from "express";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  try {
    const mcp = spawn("node", ["dist/index.cjs"]);

    let output = "";
    let error = "";

    mcp.stdout.on("data", (data) => {
      output += data.toString();
    });

    mcp.stderr.on("data", (data) => {
      error += data.toString();
    });

    mcp.on("close", () => {
      try {
        const parsed = JSON.parse(output);
        res.json(parsed);
      } catch (e) {
        console.error("❌ PARSE ERROR:", output);
        res.status(500).json({ error: "Invalid MCP response" });
      }
    });

    // 🔥 enviar request MCP real
    mcp.stdin.write(JSON.stringify(req.body) + "\n");
    mcp.stdin.end();

  } catch (e: any) {
    console.error("❌ MCP WRAPPER ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (_, res) => {
  res.send("MCP HTTP wrapper alive 🧠");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("MCP HTTP wrapper running");
});
