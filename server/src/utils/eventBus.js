// A minimal in-process event bus used to decouple "an action happened" from
// "deliver a notification for it" -- see Section 2.4 / 3.3 of the design
// decisions document. Handlers are invoked asynchronously (setImmediate) so
// that publishing an event never blocks the request that triggered it.
//
// This is an intentional simplification for the assignment's scale: in a
// real deployment this module would be swapped for a client to a real
// broker (SQS, RabbitMQ, Kafka) without changing any calling code, because
// the public interface (publish/subscribe) stays the same.

const EventEmitter = require("events");

class EventBus extends EventEmitter {
  publish(eventType, payload) {
    setImmediate(() => {
      this.emit(eventType, payload);
      this.emit("*", { eventType, payload });
    });
  }

  subscribe(eventType, handler) {
    this.on(eventType, (payload) => {
      Promise.resolve(handler(payload)).catch((err) => {
        // A failed notification handler must never crash the process or
        // block the request that published the event.
        // eslint-disable-next-line no-console
        console.error(`Event handler for "${eventType}" failed:`, err);
      });
    });
  }
}

module.exports = new EventBus();
