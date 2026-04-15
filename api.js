import express from "express";

const app = express();

/**
 * Endpoint base (test)
 */
app.get("/", (req, res) => {
  res.send("Garmin API Wrapper running 🚀");
});

/**
 * Resumen diario (mock por ahora)
 */
app.get("/summary", async (req, res) => {
  try {
    const data = await getGarminData();

    res.json({
      steps: data.steps,
      sleep: data.sleep,
      stress: data.stress,
      restingHeartRate: data.rhr
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sueño
 */
app.get("/sleep", async (req, res) => {
  const data = await getGarminData();
  res.json(data.sleep);
});

/**
 * MOCK temporal (luego lo conectamos al MCP real)
 */
async function getGarminData() {
  return {
    steps: 9123,
    sleep: {
      total: 7.1,
      deep: 1.4,
      light: 4.8
    },
    stress: 38,
    rhr: 57
  };
}

export default app;
