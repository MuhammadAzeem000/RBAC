import { ConnectorDefinition } from "./types";
import { slackConnector } from "./slack.connector";
import { virustotalConnector } from "./virustotal.connector";

// No dynamic/plugin loading in this phase — a connector ships as code, same
// as the two here. Adding a third connector means adding a file and one
// line in this map, nothing else (the HTTP layer, credential storage, rate
// limiting, and audit trail are all generic against ConnectorDefinition).
export const CONNECTOR_REGISTRY: Record<string, ConnectorDefinition> = {
  slack: slackConnector,
  virustotal: virustotalConnector,
};

export function getConnectorDefinition(key: string): ConnectorDefinition | null {
  return CONNECTOR_REGISTRY[key] ?? null;
}
