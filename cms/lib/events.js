'use strict';

/**
 * In-process event bus for live dashboard updates.
 *
 * API routes publish a short event name after a successful mutation; the
 * dashboard's Server-Sent Events stream subscribes and nudges connected admins
 * to refetch. Events carry only a type (and at most a slug), never payloads:
 * the client always re-reads the aggregates from the database, so a dropped or
 * duplicated event can never leave the dashboard showing a stale number.
 *
 * This is deliberately in-process. It is the right scope for a single Node
 * instance; a multi-instance deployment would swap this for Redis pub/sub
 * without touching the routes or the client.
 */

const { EventEmitter } = require('node:events');

const bus = new EventEmitter();
// Each connected admin dashboard adds a listener. The default cap of 10 would
// warn once a few tabs are open, which is normal here.
bus.setMaxListeners(0);

const CHANNEL = 'content-changed';

/** Announce that stored content or engagement changed. */
function publish(type, detail = {}) {
  bus.emit(CHANNEL, { type, ...detail, at: new Date().toISOString() });
}

/** Subscribe to changes. Returns an unsubscribe function. */
function subscribe(listener) {
  bus.on(CHANNEL, listener);
  return () => bus.off(CHANNEL, listener);
}

module.exports = { publish, subscribe, CHANNEL };
