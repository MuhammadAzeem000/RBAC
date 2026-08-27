// Single source of truth for incident lifecycle/classification strings —
// mirrors the pattern in identity-service's constants/rbac.ts (one place to
// change so seed data, validation, and the state machine can never drift).
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

// Ordered list defines both valid values AND the forward-progress rank used
// by the lifecycle state machine (see services/incident.service.ts).
export const STATUSES = [
  "new",
  "triage",
  "investigating",
  "containment",
  "remediation",
  "resolved",
  "closed",
] as const;
export type Status = (typeof STATUSES)[number];

export const TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PLAYBOOK_RUN_STATES = ["pending_approval", "running", "succeeded", "failed", "cancelled"] as const;
export type PlaybookRunState = (typeof PLAYBOOK_RUN_STATES)[number];

// Seed data only — the runtime source of truth is the DB-backed Policy
// table (see prisma/seed.ts). One default policy covers every disruptive
// playbook's start gate for now; a policy-authoring API is a later phase
// (see the Phase 4 plan's "explicitly not in this pass"). escalationAfter
// fires a best-effort Slack notification to escalationChannel if the
// approval sits undecided that long, before finally expiring at
// timeoutDuration if it's still undecided.
export const POLICY_SEED_DATA = [
  {
    key: "disruptive-action",
    name: "Disruptive Action",
    timeoutDuration: "24 hours",
    escalationAfter: "12 hours",
    escalationChannel: "#soc-escalations",
  },
] as const;

// Seed data only — the runtime catalog is now the DB-backed Playbook /
// PlaybookVersion tables (see prisma/seed.ts, which inserts these as each
// tenant's starting catalog, and services/playbookCatalog.service.ts, which
// serves it). `requiresApproval` is now a denormalized display flag —
// `startPolicyKey` (referencing POLICY_SEED_DATA above) is what actually
// gates the run; a step's own `policyKey` (none of these use one yet) would
// gate that individual step instead of the whole run's start. Most `steps`
// are still simulated actions (no real connector bound) but now run as
// real, individually-retried, individually-audited Temporal Activities (see
// src/temporal/) instead of one opaque timer — each step becomes its own
// StepExecution row. `enrich-ioc`'s last two steps ARE real (Phase 3): they
// set `connector`/`action` and execute through integration-service's
// connector runtime against the live Slack/VirusTotal APIs — see
// temporal/activities.ts's runStep(). The VirusTotal lookup targets a fixed
// demo IP (8.8.8.8) since there's no real alert-entity pipeline binding a
// step's params to an actual incident's indicators yet — a later phase's
// work, not this one's.
export const PLAYBOOK_SEED_DATA = [
  {
    key: "enrich-ioc",
    name: "Enrich Indicators of Compromise",
    description: "Look up reputation/context for IPs, domains, and hashes referenced by the incident.",
    requiresApproval: false,
    startPolicyKey: null,
    steps: [
      { key: "lookup-ip-reputation", name: "Look up IP reputation", config: {} },
      { key: "lookup-domain-reputation", name: "Look up domain reputation", config: {} },
      { key: "lookup-file-hash-reputation", name: "Look up file hash reputation", config: {} },
      {
        key: "lookup-ip-virustotal",
        name: "Look up IP reputation via VirusTotal",
        connector: "virustotal",
        action: "lookupIp",
        config: { ip: "8.8.8.8" },
      },
      {
        key: "notify-soc-slack",
        name: "Notify SOC via Slack",
        connector: "slack",
        action: "postMessage",
        config: { channel: "#soc-alerts", text: "Enrich-IOC playbook completed — see incident for details." },
      },
    ],
  },
  {
    key: "isolate-host",
    name: "Isolate Host",
    description: "Network-isolate an affected endpoint to contain active spread.",
    requiresApproval: true,
    startPolicyKey: "disruptive-action",
    steps: [
      { key: "network-isolate", name: "Network-isolate endpoint", config: {} },
      { key: "disable-host-network", name: "Disable host network adapter", config: {} },
    ],
  },
  {
    key: "disable-user-account",
    name: "Disable User Account",
    description: "Disable a compromised user account pending investigation.",
    requiresApproval: true,
    startPolicyKey: "disruptive-action",
    steps: [
      { key: "disable-account", name: "Disable user account", config: {} },
      { key: "revoke-sessions", name: "Revoke active sessions", config: {} },
    ],
  },
  {
    key: "reset-credentials",
    name: "Reset Credentials",
    description: "Force a credential reset for an affected account.",
    requiresApproval: true,
    startPolicyKey: "disruptive-action",
    steps: [
      { key: "force-password-reset", name: "Force password reset", config: {} },
      { key: "revoke-api-tokens", name: "Revoke API tokens", config: {} },
    ],
  },
  {
    key: "notify-stakeholders",
    name: "Notify Stakeholders",
    description: "Send a status update to the configured incident stakeholder list.",
    requiresApproval: false,
    startPolicyKey: null,
    steps: [{ key: "send-stakeholder-notification", name: "Send stakeholder notification", config: {} }],
  },
] as const;

export type PlaybookSeedKey = (typeof PLAYBOOK_SEED_DATA)[number]["key"];
