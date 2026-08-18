// Shared RabbitMQ topology. The backend publishes to this exchange without
// knowing who (if anyone) is listening — consumers (e.g. notification-service)
// own their own queues and bind to the routing keys they care about. Keep in
// sync with notification-service/src/rabbitmq/topology.ts.
export const EVENTS_EXCHANGE = "rbac.events";
export const USER_CREATED_ROUTING_KEY = "user.created";
