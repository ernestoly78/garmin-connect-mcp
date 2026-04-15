import express from "express";

const app = express();

app.get("/", (_, res) => {
  res.send("MCP alive 🧠");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("MCP HTTP server running");
});
