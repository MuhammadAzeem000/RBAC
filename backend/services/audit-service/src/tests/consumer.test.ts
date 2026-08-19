import { Channel, ConsumeMessage } from "amqplib";
import { handleMessage } from "../events/consumer";
import * as auditLogService from "../services/auditLog.service";
import { AuditEventMessage } from "../interfaces/auditEvent";

jest.mock("../services/auditLog.service", () => ({
  persistIdempotent: jest.fn(),
}));

const mockedService = auditLogService as unknown as { persistIdempotent: jest.Mock };

function makeMsg(event: AuditEventMessage | string): ConsumeMessage {
  const body = typeof event === "string" ? event : JSON.stringify(event);
  return { content: Buffer.from(body, "utf8") } as unknown as ConsumeMessage;
}

function mockChannel() {
  return { ack: jest.fn(), nack: jest.fn() } as unknown as jest.Mocked<Channel>;
}

const event: AuditEventMessage = {
  eventId: "event-abc",
  eventType: "INCIDENT_CREATED",
  timestamp: "2026-08-19T00:00:00.000Z",
  service: "incident-service",
  actorId: "1",
  actorType: "USER",
  action: "CREATE",
  resourceType: "INCIDENT",
  resourceId: "42",
};

describe("consumer handleMessage", () => {
  it("acks only after successful persistence", async () => {
    mockedService.persistIdempotent.mockResolvedValue({ created: true });
    const channel = mockChannel();
    const msg = makeMsg(event);

    await handleMessage(channel, msg);

    expect(mockedService.persistIdempotent).toHaveBeenCalledWith(event);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("acks when the event was already persisted (idempotent redelivery) — no duplicate work treated as failure", async () => {
    mockedService.persistIdempotent.mockResolvedValue({ created: false });
    const channel = mockChannel();
    const msg = makeMsg(event);

    await handleMessage(channel, msg);

    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it("dead-letters immediately on a malformed payload without ever acking", async () => {
    const channel = mockChannel();
    const msg = makeMsg("not valid json{{{");

    await handleMessage(channel, msg);

    expect(mockedService.persistIdempotent).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  });

  it("retries transient persistence failures before giving up and dead-lettering, never acking", async () => {
    mockedService.persistIdempotent.mockRejectedValue(new Error("DB connection refused"));
    const channel = mockChannel();
    const msg = makeMsg(event);

    await handleMessage(channel, msg);

    expect(mockedService.persistIdempotent).toHaveBeenCalledTimes(3);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  }, 10000);

  it("acks on the second attempt if a transient failure clears before retries are exhausted", async () => {
    mockedService.persistIdempotent
      .mockRejectedValueOnce(new Error("DB connection refused"))
      .mockResolvedValueOnce({ created: true });
    const channel = mockChannel();
    const msg = makeMsg(event);

    await handleMessage(channel, msg);

    expect(mockedService.persistIdempotent).toHaveBeenCalledTimes(2);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("ignores a null message (amqplib's cancel-signal convention)", async () => {
    const channel = mockChannel();
    await handleMessage(channel, null);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });
});
