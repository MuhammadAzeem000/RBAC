// Shared RabbitMQ topology. The backend service publishes to this exchange
// without knowing who (if anyone) is listening — this service owns its own
// queue and binds it to the routing keys it cares about. Keep the exchange
// name and routing keys in sync with backend/src/events/topology.ts.
export const EVENTS_EXCHANGE = "rbac.events";
export const USER_CREATED_ROUTING_KEY = "user.created";
export const QUEUE_NAME = "notification-service.user-created";
