import "../utils/bigint";
import { prisma } from "../config/prisma";
import { sendEmail } from "../email/mailer";
import { handleMessage } from "../rabbitmq/consumer";

jest.mock("../config/prisma", () => {
  const resources = {
    notification: { create: jest.fn() },
    outboxEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  return { prisma: { ...resources, $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(resources)) } };
});
jest.mock("../email/mailer", () => ({ sendEmail: jest.fn() }));

const mockedPrisma = prisma as unknown as {
  notification: { create: jest.Mock };
  outboxEvent: { create: jest.Mock };
};
const mockedSendEmail = sendEmail as jest.Mock;

function eventBuffer(payload: Record<string, unknown>): Buffer {
  return Buffer.from(JSON.stringify(payload), "utf-8");
}

describe("notification consumer — atomic Notification + outbox on send", () => {
  const event = { userId: "1", tenantId: "1", name: "Alice", email: "alice@example.com" };

  it("records a 'sent' Notification and NOTIFICATION_SENT outbox event on success", async () => {
    mockedSendEmail.mockResolvedValue(undefined);
    mockedPrisma.notification.create.mockResolvedValue({ id: 1n });

    await handleMessage(eventBuffer(event));

    expect(mockedPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent", recipientEmail: event.email }) }),
    );
    expect(mockedPrisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "NOTIFICATION_SENT" }) }),
    );
  });

  it("records a 'failed' Notification and NOTIFICATION_FAILED outbox event, then rethrows, when sending fails", async () => {
    mockedSendEmail.mockRejectedValue(new Error("SMTP down"));
    mockedPrisma.notification.create.mockResolvedValue({ id: 2n });

    await expect(handleMessage(eventBuffer(event))).rejects.toThrow();

    expect(mockedPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", errorMessage: expect.stringContaining("SMTP down") }),
      }),
    );
    expect(mockedPrisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "NOTIFICATION_FAILED" }) }),
    );
  });

  it("never creates the outbox event without also creating the Notification row (same transaction)", async () => {
    mockedSendEmail.mockResolvedValue(undefined);
    mockedPrisma.notification.create.mockRejectedValue(new Error("DB down"));

    await expect(handleMessage(eventBuffer(event))).rejects.toThrow("DB down");

    expect(mockedPrisma.outboxEvent.create).not.toHaveBeenCalled();
  });
});
