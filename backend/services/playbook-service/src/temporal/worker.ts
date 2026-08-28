import { NativeConnection, Worker } from "@temporalio/worker";
import { env } from "../config/env";
import * as activities from "./activities";
import { PLAYBOOK_TASK_QUEUE } from "./types";

// Fire-and-forget, started from server.ts the same way startOutboxPublisher()
// already is — retries its own connection rather than blocking server boot
// or crashing the whole process if Temporal isn't reachable yet.
export async function startPlaybookWorker(): Promise<void> {
  for (;;) {
    try {
      const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS });
      const worker = await Worker.create({
        connection,
        namespace: "default",
        taskQueue: PLAYBOOK_TASK_QUEUE,
        // A file path, not a module import — Temporal bundles this file
        // (and only what it transitively imports) into the sandboxed
        // isolate itself; the surrounding Node process never runs it directly.
        workflowsPath: require.resolve("./workflows"),
        activities,
      });
      console.log(`Temporal worker started on task queue "${PLAYBOOK_TASK_QUEUE}"`);
      await worker.run();
      console.warn("Temporal worker stopped — reconnecting in 5s");
    } catch (error) {
      console.error("Temporal worker error, retrying in 5s:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
