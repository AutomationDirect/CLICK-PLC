const { Readable } = require('stream')
const QlobberSub = require('qlobber/aedes/qlobber-sub')
const { QlobberTrue } = require('qlobber')
const Packet = require('aedes-packet')

const sqlite3 = require('sqlite3')

// options constrolling wildcard behavior in MQTT topic matching
const QlobberOpts = {
  wildcard_one: '+', // matches one level
  wildcard_some: '#', // matches many levels
  separator: '/' // this separates the levels
}
// so a topic can come in like "temperature/#/house14" and that would mean 
// there can be infinite things between temperature and house14

// this just tells helpter functions to create a container if one is missing
const CREATE_ON_EMPTY = true

/**
 * Generator: iterates over multiple iterable collections sequentially
 * @param {Iterable[]} iterables - array of iterables to chain
 */
function * multiIterables (iterables) {
  for (const iter of iterables) {
    yield * iter
  }
}

/**
 * Generator: yields retained packets matching a given MQTT pattern.
 * @param {Map} retained - mapping of topic to packets from retained messages
 * @param {string} pattern - MQTT subscription pattern (this can include those wildcards)
 */
function * retainedMessagesByPattern (retained, pattern) {
  const qlobber = new QlobberTrue(QlobberOpts)
  qlobber.add(pattern) // add the pattern to the matcher

  for (const [topic, packet] of retained) {
    if (qlobber.test(topic)) {
      yield packet // if the topic matches the subscription then go ahead and yield the packet
    }
  }
}

/**
 * Generator: yields "will messages" from brokers not in supplied broker list
 * @param {Map} wills - maps clientId to will packet
 * @param {Object} brokers - maps brokerId to broker information
 */
function * willsByBrokers (wills, brokers) {
  for (const will of wills.values()) {
    if (!brokers[will.brokerId]) {
      yield will
    }
  }
}

/**
 * Generator: yields clientIds that are subscribed to a given topic
 * @param {Map} subscriptions - maps clientId to another map of "topic -> subscription metadata"
 * @param {string} topic - The topic we're looking for
 */
function * clientListbyTopic (subscriptions, topic) {
  for (const [clientId, topicMap] of subscriptions) {
    if (topicMap.has(topic)) {
      yield clientId
    }
  }
}

class MemoryPersistence {
  // private class members start with #
  #retained
  #subscriptions
  #outgoing
  #incoming
  #wills
  #clientsCount
  #trie

  #db

  /**
   * @type {Map}
   */
  #options

  /**
   * 
   * @param {Object} opts 
   */
  constructor (opts = {}) {
    // using Maps for convenience and security (risk on prototype polution)
    // Map ( topic -> packet )
    this.#retained = new Map()
    // Map ( clientId -> Map( topic -> { qos, rh, rap, nl } ))
    this.#subscriptions = new Map()
    // Map ( clientId  > [ packet ] }
    this.#outgoing = new Map()
    // Map ( clientId -> { packetId -> Packet } )
    this.#incoming = new Map()
    // Map( clientId -> will )
    this.#wills = new Map()
    this.#clientsCount = 0
    this.#trie = new QlobberSub(QlobberOpts)

    // default to using sqlite
    this.#options = opts
    if (!this.#options.hasOwnProperty("use_sqlite") || true) {
      this.#options.use_sqlite = true;
    }

    // setup sqlite connection
    if (this.#options.use_sqlite) {
      this.#db = new sqlite3.Database('/usr/local/nred-work/aedes.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) return err;
        this.#db.exec(`
          CREATE TABLE IF NOT EXISTS retained (
            topic TEXT PRIMARY KEY,
            payload BLOB,
            qos INTEGER,
            retain INTEGER,
            added DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS subscriptions (
            clientId TEXT,
            topic TEXT,
            qos INTEGER,
            added DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (clientId, topic)
          );
          CREATE TABLE IF NOT EXISTS incoming (
            clientId TEXT,
            messageId INTEGER,
            packet BLOB,
            PRIMARY KEY (clientId, messageId)
          );
          CREATE TABLE IF NOT EXISTS outgoing (
            clientId TEXT,
            brokerId TEXT,
            brokerCounter INTEGER,
            messageId INTEGER,
            packet BLOB,
            PRIMARY KEY (clientId, brokerId, brokerCounter)
          );
          CREATE TABLE IF NOT EXISTS will (
            clientId TEXT PRIMARY KEY,
            packet BLOB
          );`, (execErr) => {
            if (execErr) console.error(execErr);
      

            this.#db.all(`SELECT * FROM subscriptions`, (subErr, subs) => {
              if (subErr) console.error(subErr);

              for (const sub of subs) {
                  this.#trie.add(sub.topic, sub);
              }

              this.#loadPersistedState()

              /** 
               * So this was in my other version of SQLite Persistence.
               * My understanding is that BroadcastPersistence is only for 
               * clustered Aedes setup (like you have multiple brokers 
               * that are all sharing the same state). This will only be
               * used in one specific Node, so I will not need this.


              this.#broadcast = new BroadcastPersistence(broker, this.#trie);
              this.#broadcast.brokerSubscribe(done);
              */
            });
          }
        );
      })
    }
  }

  #loadPersistedState() {
    // Load retained messages
    this.#db.all('SELECT * FROM retained', (err, rows) => {
      if (err) return console.error('Error loading retained:', err);
      for (const row of rows) {
        this.#retained.set(row.topic, {
          topic: row.topic,
          payload: row.payload, // buffer
          qos: row.qos,
          retain: !!row.retain
        });
      }
    });

    // Load outgoing packets
    this.#db.all('SELECT * FROM outgoing', (err, rows) => {
      if (err) return console.error('Error loading outgoing:', err);
      for (const row of rows) {
        let pkt;
        try {
          pkt = deserializePacket(row.packet);
        } catch (e) {
          console.error('Corrupt outgoing packet:', row, e);
          continue;
        }
        const arr = this.#outgoing.get(row.clientId) || [];
        arr.push(pkt);
        this.#outgoing.set(row.clientId, arr);
      }
    });

    // Load incoming packets
    this.#db.all('SELECT * FROM incoming', (err, rows) => {
      if (err) return console.error('Error loading incoming:', err);
      for (const row of rows) {
        let pkt;
        try {
          pkt = deserializePacket(row.packet);
        } catch (e) {
          console.error('Corrupt incoming packet:', row, e);
          continue;
        }
        let store = this.#incoming.get(row.clientId);
        if (!store) {
          store = {};
          this.#incoming.set(row.clientId, store);
        }
        store[row.messageId] = pkt;
      }
    });

    // Load will messages
    this.#db.all('SELECT * FROM will', (err, rows) => {
      if (err) return console.error('Error loading wills:', err);
      for (const row of rows) {
        let pkt;
        try {
          pkt = deserializePacket(row.packet);
        } catch (e) {
          console.error('Corrupt will packet:', row, e);
          continue;
        }
        this.#wills.set(row.clientId, pkt);
      }
    });
  }

  /**
   * Store or delete a retained message
   * @param {Packet} pkt - packet containing topic & payload
   * @param {Function} cb - callback invoked when done
   */
  storeRetained (pkt, cb) {
    const packet = Object.assign({}, pkt)
    // if this function gets called with an empty payload...
    if (packet.payload.length === 0) {
      // ... it means to remove the retained message.
      this.#retained.delete(packet.topic)
      this.#db.run(
        `DELETE FROM retained WHERE topic = ?`, [packet.topic]
      )
    // if this function does NOT get called with an empty payload...
    } else {
      // ... it means to set the topic to current retained message
      this.#retained.set(packet.topic, packet)
      this.#db.run(
        `INSERT INTO retained (topic, payload, qos, retain, added)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT (topic) DO UPDATE SET
          payload=excluded.payload,
          qos=excluded.qos,
          retain=excluded.retain,
          added=datetime('now')
        `,
        [packet.topic, packet.payload, packet.qos, packet.retain ? 1 : 0]
      )
    }
    cb(null)
  }

  /**
   * Create a readable stream merging retained messages for MULTIPLE patterns.
   * 
   * For a SINGLE pattern see `createRetainedStream()`.
   * @param {*} patterns MQTT subscription patterns
   * @returns {Readable} Stream emitting matching packets
   */
  createRetainedStreamCombi (patterns) {
    const iterables = patterns.map((p) => {
      return retainedMessagesByPattern(this.#retained, p)
    })
    return Readable.from(multiIterables(iterables))
  }

  /**
   * Create a readable stream of retained messages matching a SINGLE pattern.
   * @param {*} pattern MQTT subscription pattern
   * @returns {Readable} Stream emitting matching packets
   */
  createRetainedStream (pattern) {
    // NOTE: I wonder if we can just call `createRetainedStreamCombi([pattern])`?
    return Readable.from(retainedMessagesByPattern(this.#retained, pattern))
  }

  /**
   * Add (or update) subscriptions for a client.
   * @param {Object} client client object (has .id)!
   * @param {Array} subs Array of {topic, qos, rh, rap, nl}
   * @param {Function} cb The callback function (err, client)
   */
  addSubscriptions (client, subs, cb) {
    let stored = this.#subscriptions.get(client.id)
    const trie = this.#trie

    if (!stored) {
      stored = new Map()
      this.#subscriptions.set(client.id, stored)
      this.#clientsCount++
    }

    for (const sub of subs) {
      const storedSub = stored.get(sub.topic)
      if (sub.qos > 0) {
        // only store in trie if QoS > 0 (needs QoS tracking)
        trie.add(sub.topic, {
          clientId: client.id,
          topic: sub.topic,
          qos: sub.qos,
          rh: sub.rh,
          rap: sub.rap,
          nl: sub.nl
        })

        // and now upsert in sqlite
        this.#db.run(
          `INSERT INTO subscriptions (clientId, topic, qos, added) 
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(clientId, topic) DO UPDATE SET
            qos=excluded.qos,
            added=datetime('now')`,
            [client.id, sub.topic, sub.qos]
        )
      } else if (storedSub?.qos > 0) {
        // removed subscription reduces it from trie
        trie.remove(sub.topic, {
          clientId: client.id,
          topic: sub.topic
        })
        this.#db.run(
          `DELETE FROM subscriptions WHERE clientId = ? AND topic = ?`,
          [client.id, sub.topic]
        )
      }
      stored.set(sub.topic, { 
        qos: sub.qos, 
        rh: sub.rh, 
        rap: sub.rap, 
        nl: sub.nl 
      })
    }

    cb(null, client)
  }

  /**
   * Remove specific subscriptions for a client.
   * @param {Object} client 
   * @param {string[]} subs 
   * @param {Function} cb 
   */
  removeSubscriptions (client, subs, cb) {
    const stored = this.#subscriptions.get(client.id)
    const trie = this.#trie

    if (stored) {
      for (const topic of subs) {
        const storedSub = stored.get(topic)
        if (storedSub !== undefined) {
          if (storedSub.qos > 0) {
            trie.remove(topic, { clientId: client.id, topic })
          }
          stored.delete(topic)

          this.#db.run(
            `DELETE FROM subscriptions WHERE clientId = ? AND topic = ?`,
            [client.id, topic],
            (err) => {
              if (err) console.error('SQLITE error deleting subscription: ', err)
            }
          );
        }
      }

      if (stored.size === 0) {
        this.#clientsCount--
        this.#subscriptions.delete(client.id)
      }
    }

    cb(null, client)
  }

  /**
   * Fetch all subscriptions for a given client.
   * @param {Object} client The client (has .id)
   * @param {Function} cb The callback function to signal you're done.
   */
  subscriptionsByClient (client, cb) {
    let subs = null
    const stored = this.#subscriptions.get(client.id)
    if (stored) {
      subs = []
      for (const [topic, storedSub] of stored) {
        subs.push({ topic, ...storedSub })
      }
    }
    cb(null, subs, client)
  }

  /**
   * Count how many offline subscriptions (from the trie) and the total client count
   * @param {*} cb The callback function
   * @returns
   */
  countOffline (cb) {
    return cb(null, this.#trie.subscriptionsCount, this.#clientsCount)
  }

  /**
   * Retrieve subscriptions matching a specific topic/pattern
   * @param {*} pattern 
   * @param {*} cb 
   */
  subscriptionsByTopic (pattern, cb) {
    cb(null, this.#trie.match(pattern))
  }

  /**
   * Remove all subscriptions for a client (cleanup on disconnect)
   * @param {*} client 
   * @param {*} cb 
   */
  cleanSubscriptions (client, cb) {
    // NOTE: this could be quickened by doing this.subscriptionsByClient and then this.removeSubscriptions on them
    const trie = this.#trie
    const stored = this.#subscriptions.get(client.id)

    if (stored) {
      for (const [topic, storedSub] of stored) {
        if (storedSub.qos > 0) {
          trie.remove(topic, { clientId: client.id, topic })
        }

        this.#db.run(
          `DELETE FROM subscriptions WHERE clientId = ? AND topic = ?`,
          [client.id, topic],
          (err) => {
            if (err) console.error('SQLITE error deleting subscription: ', err)
          }
        );
      }

      this.#clientsCount--
      this.#subscriptions.delete(client.id)
    }

    cb(null, client)
  }

  /**
   * Helper to enqueue an outgoing packet per subscriber
   * @param {*} sub 
   * @param {*} packet 
   * @private
   */
  #outgoingEnqueuePerSub (sub, packet) {
    const id = sub.clientId
    const queue = getMapRef(this.#outgoing, id, [], CREATE_ON_EMPTY)
    queue[queue.length] = new Packet(packet)
  }

  /**
   * Enqueue a packet for a specific subscriber
   * @param {*} sub 
   * @param {*} packet 
   * @param {*} cb 
   */
  outgoingEnqueue (sub, packet, cb) {
    this.#outgoingEnqueuePerSub(sub, packet)

    this.#db.run(
      `INSERT INTO outgoing (clientId, brokerId, brokerCounter, messageId, packet)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (clientId, brokerId, brokerCounter) DO UPDATE SET
        messageId=excluded.messageId,
        packet=excluded.packet`,
      [sub.clientId, packet.brokerId, packet.brokerCounter, packet.messageId, asPacket(packet)],
      (err) => {
        if (err) console.error("SQLite error upserting ougoing: ", err);
      }
    );

    process.nextTick(cb)
  }

  /**
   * Enqueue the same packet for multiple subscribers
   * @param {*} subs 
   * @param {*} packet 
   * @param {*} cb 
   */
  outgoingEnqueueCombi (subs, packet, cb) {
    for (let i = 0; i < subs.length; i++) {
      this.#outgoingEnqueuePerSub(subs[i], packet)

      this.#db.run(
        `INSERT INTO outgoing (clientId, brokerId, brokerCounter, messageId, packet)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (clientId, brokerId, brokerCounter) DO UPDATE SET
          messageId=excluded.messageId,
          packet=excluded.packet`,
        [subs[i].clientId, packet.brokerId, packet.brokerCounter, packet.messageId, asPacket(packet)]
      )
    }
    process.nextTick(cb)
  }

  /**
   * Update an outgoing packet's messageId based on broker session info.
   * @param {*} client 
   * @param {*} packet 
   * @param {*} cb 
   * @returns 
   */
  outgoingUpdate (client, packet, cb) {
    const outgoing = getMapRef(this.#outgoing, client.id, [], CREATE_ON_EMPTY)

    let temp
    for (let i = 0; i < outgoing.length; i++) {
      temp = outgoing[i]
      if (temp.brokerId === packet.brokerId) {
        if (temp.brokerCounter === packet.brokerCounter) {
          temp.messageId = packet.messageId

          this.#db.run(
            `UPDATE outgoing SET messageId = ?, packet = ? WHERE clientId = ? AND brokerId = ? AND brokerCounter = ?`,
            [
              packet.messageId,
              asPacket(temp),
              client.id,
              packet.brokerId,
              packet.brokerCounter
            ]
          )

          return cb(null, client, packet)
        }
        /*
                Maximum of messageId (packet identifier) is 65535 and will be rotated,
                brokerCounter is to ensure the packet identifier be unique.
                The for loop is going to search which packet messageId should be updated
                in the #outgoing queue.
                If there is a case that brokerCounter is different but messageId is same,
                we need to let the loop keep searching
                */
      } else if (temp.messageId === packet.messageId) {
        outgoing[i] = packet

        this.#db.run(
          `UPDATE outgoing SET brokerId = ?, brokerCounter = ?, packet = ? WHERE clientId = ? AND messageId = ?`,
          [
            packet.brokerId,
            packet.brokerCounter,
            asPacket(packet),
            client.id,
            packet.messageId
          ]
        )
        return cb(null, client, packet)
      }
    }

    cb(new Error('no such packet'), client, packet)
  }

  outgoingClearMessageId (client, packet, cb) {
    const outgoing = getMapRef(this.#outgoing, client.id, [], CREATE_ON_EMPTY)

    let temp
    for (let i = 0; i < outgoing.length; i++) {
      temp = outgoing[i]
      if (temp.messageId === packet.messageId) {
        outgoing.splice(i, 1)
        this.#db.run(
          `DELETE FROM outgoing WHERE clientId = ? AND messageId = ?`,
          [client.id, packet.messageId]
        )
        return cb(null, temp)
      }
    }

    cb()
  }

  outgoingStream (client) {
    // console.log('1')
    // console.log(outgoing_sql)

    // const packets = outgoing_sql.map(row => JSON.parse(row.packet));
    // console.log('== outgoing stream ==')
    // return Readable.from(packets, { objectMode: true });

    // shallow clone the outgoing queue for this client to avoid race conditions
    const outgoing = [].concat(getMapRef(this.#outgoing, client.id, []))
    return Readable.from(outgoing)
  }

  incomingStorePacket (client, packet, cb) {
    const id = client.id
    const store = getMapRef(this.#incoming, id, {}, CREATE_ON_EMPTY)

    store[packet.messageId] = new Packet(packet)
    store[packet.messageId].messageId = packet.messageId

    this.#db.run(
      `INSERT OR REPLACE INTO incoming (clientId, messageId, packet)
      VALUES (?, ?, ?)`,
      [client.id, packet.messageId, asPacket(packet)]
    )

    cb(null)
  }

  incomingGetPacket (client, packet, cb) {
    const id = client.id
    const store = getMapRef(this.#incoming, id, {})
    let err = null

    this.#incoming.set(id, store)

    if (!store[packet.messageId]) {
      err = new Error('no such packet')
    }

    cb(err, store[packet.messageId])
  }

  incomingDelPacket (client, packet, cb) {
    const id = client.id
    const store = getMapRef(this.#incoming, id, {})
    const toDelete = store[packet.messageId]
    let err = null

    if (!toDelete) {
      err = new Error('no such packet')
    } else {
      delete store[packet.messageId]
      this.#db.run(
        `DELETE FROM incoming WHERE clientId = ? AND messageId = ?`,
        [client.id, packet.messageId]
      )
    }

    cb(err)
  }

  putWill (client, packet, cb) {
    packet.brokerId = this.broker.id
    packet.clientId = client.id
    this.#wills.set(client.id, packet)
    this.#db.run(
      `INSERT OR REPLACE INTO will (clientId, packet) VALUES (?, ?)`,
      [client.id, asPacket(packet)]
    );
    cb(null, client)
  }

  getWill (client, cb) {
    cb(null, this.#wills.get(client.id), client)
  }

  delWill (client, cb) {
    const will = this.#wills.get(client.id)
    this.#wills.delete(client.id)
    this.#db.run(`DELETE FROM will WHERE clientId = ?`, [client.id])
    cb(null, will, client)
  }

  streamWill (brokers = {}) {
    return Readable.from(willsByBrokers(this.#wills, brokers))
  }

  getClientList (topic) {
    return Readable.from(clientListbyTopic(this.#subscriptions, topic))
  }

  destroy (cb) {
    this.#retained = null
    this.#subscriptions = null;
    this.#outgoing = null;
    this.#incoming = null;
    this.#wills = null;
    this.#db.close()
    if (cb) {
      cb(null)
    }
  }
}

function getMapRef (map, key, ifEmpty, createOnEmpty = false) {
  const value = map.get(key)
  if (value === undefined && createOnEmpty) {
    map.set(key, ifEmpty)
  }
  return value || ifEmpty
}

function asPacket(obj) {
  const packet = obj?.packet || obj;
  if (!packet) throw new Error('Invalid packet');
  if (Buffer.isBuffer(packet?.payload?.buffer)) {
      packet.payload = packet.payload.buffer;
  }
  return Buffer.from(JSON.stringify(packet));
}

/**
 * Deserialize a packet stored as a BLOB (Buffer) in SQLite.
 * Handles Buffer from JSON.stringify/Buffer.from
 */
function deserializePacket(blob) {
  // If stored as JSON string (Buffer or string), decode and parse
  let raw;
  if (Buffer.isBuffer(blob)) {
    raw = blob.toString('utf8');
  } else if (typeof blob === 'string') {
    raw = blob;
  } else {
    throw new Error('Unknown packet blob type');
  }
  const obj = JSON.parse(raw);
  // Restore payload as Buffer if it was a {type: 'Buffer', data: [...]} object
  if (obj.payload && obj.payload.type === 'Buffer' && Array.isArray(obj.payload.data)) {
    obj.payload = Buffer.from(obj.payload.data);
  }
  return new Packet(obj);
}

module.exports = () => { return new MemoryPersistence() }
module.exports.Packet = Packet