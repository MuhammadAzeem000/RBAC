import express from "express";
import { env } from "./config/env";
import { startConsumer } from "./rabbitmq/consumer";

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(env.PORT, () => {
  console.log(`notification-service health endpoint on port ${env.PORT}`);
});

startConsumer().catch((error) => {
  console.error("notification-service failed to start its RabbitMQ consumer:", error);
  process.exit(1);
});
