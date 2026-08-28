import { ConnectorDefinition } from "./types";
import { slackConnector } from "./slack.connector";
import { virustotalConnector } from "./virustotal.connector";
import { smtpConnector } from "./smtp.connector";
import { qradarConnector } from "./qradar.connector";
import { fortigateConnector } from "./fortigate.connector";
import { crowdstrikeConnector } from "./crowdstrike.connector";
import { defenderConnector } from "./defender.connector";

// No dynamic/plugin loading in this phase — a connector ships as code, same
// as the ones here. Adding a connector means adding a file and one line in
// this map, nothing else (the HTTP layer, credential storage, rate
// limiting, and audit trail are all generic against ConnectorDefinition).
export const CONNECTOR_REGISTRY: Record<string, ConnectorDefinition> = {
  slack: slackConnector,
  virustotal: virustotalConnector,
  smtp: smtpConnector,
  qradar: qradarConnector,
  fortigate: fortigateConnector,
  crowdstrike: crowdstrikeConnector,
  defender: defenderConnector,
};

export function getConnectorDefinition(key: string): ConnectorDefinition | null {
  return CONNECTOR_REGISTRY[key] ?? null;
}
