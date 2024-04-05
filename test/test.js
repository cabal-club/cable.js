// SPDX-FileCopyrightText: 2023 the cable.js authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

const test = require("tape")
const cable = require("../index")
const constants = require("../constants")
const crypto = require("../cryptography")
const b4a = require("b4a")

const CANCEL_REQUEST = cable.CANCEL_REQUEST
const POST_REQUEST = cable.POST_REQUEST
const POST_RESPONSE = cable.POST_RESPONSE
const HASH_RESPONSE = cable.HASH_RESPONSE
const CHANNEL_LIST_RESPONSE = cable.CHANNEL_LIST_RESPONSE
const TIME_RANGE_REQUEST = cable.TIME_RANGE_REQUEST
const CHANNEL_STATE_REQUEST = cable.CHANNEL_STATE_REQUEST
const CHANNEL_LIST_REQUEST = cable.CHANNEL_LIST_REQUEST
const TEXT_POST = cable.TEXT_POST
const DELETE_POST = cable.DELETE_POST
const INFO_POST = cable.INFO_POST
const TOPIC_POST = cable.TOPIC_POST
const JOIN_POST = cable.JOIN_POST
const LEAVE_POST = cable.LEAVE_POST

function generateFakeHashes (amount) {
  const hashes = []
  for (let i = 0; i < amount; i++) {
    hashes.push(crypto.hash(crypto.generateReqID()))
  }
  return hashes
}

const errorPattern = /expected/

test("test passes", t => {
  t.plan(1)
  t.pass("this test always passes")
})

test("0: hash response", t => {
  const hashes = generateFakeHashes(3)
  const reqid = crypto.generateReqID()
  const buf = HASH_RESPONSE.create(reqid, hashes)
  t.equal(cable.peekMessage(buf), constants.HASH_RESPONSE, "message type should be hash response")
  t.comment("msg type of hash response", cable.peekMessage(buf))
  const obj = HASH_RESPONSE.toJSON(buf)
  t.deepEqual(obj.reqid, reqid, "reqid should be same")
  t.equal(obj.hashes.length, hashes.length, "hashes should be same length")
  t.deepEqual(obj.hashes, hashes, "hashes should have same content")
  t.equal(obj.msgType, constants.HASH_RESPONSE, "deserialized object should have msg type for hash response")
  t.end()
})

test("0: hash response - wrong parameters", t => {
  const hashes = generateFakeHashes(3)
  // reqid is incorrect
  t.throws(() => {
    const buf = HASH_RESPONSE.create("reqId", hashes)
  }, errorPattern,"should error when passed faulty type for reqid")
  // hashes is incorrect
  t.throws(() => {
    const buf = HASH_RESPONSE.create(crypto.generateReqID(), "hashes")
  },  errorPattern, "should error when passed faulty type for reqid")
  // number of arguments is incorrect
  t.throws(() => {
    const buf = HASH_RESPONSE.create(crypto.generateReqID())
  },  errorPattern, "should error when missing argument")
  t.end()
})

test("1: post response", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const requestedPosts = [LEAVE_POST.create(keypair.publicKey, keypair.secretKey, links, "introduction", 124)]
  const reqid = crypto.generateReqID()

  const buf = POST_RESPONSE.create(reqid, requestedPosts)
  t.equal(cable.peekMessage(buf), constants.POST_RESPONSE, "message type should be post response")
  const obj = POST_RESPONSE.toJSON(buf)
  t.equal(obj.msgType, constants.POST_RESPONSE, "deserialized message type should also be post response")
  t.same(obj.reqid, reqid, "reqid should be same")
  t.deepEqual(obj.posts, requestedPosts, "decoded payload should be same as input")
  t.end()
})

test("1: post response - wrong parameters", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const requestedPosts = [LEAVE_POST.create(keypair.publicKey, keypair.secretKey, links, "introduction", 124)]
  const reqid = crypto.generateReqID()
  // reqid is incorrect
  t.throws(() => {
    const buf = POST_RESPONSE.create("reqid", requestedPosts)
  }, errorPattern,"should error when passed faulty type for reqid")
  // payload is incorrect
  t.throws(() => {
    const buf = POST_RESPONSE.create(reqid, "")
  },  errorPattern, "should error when passed faulty type for posts")
  // number of arguments is incorrect
  t.throws(() => {
    const buf = POST_RESPONSE.create(crypto.generateReqID())
  },  errorPattern, "should error when missing argument")
  t.end()
})

test("7: channel list response", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const reqid = crypto.generateReqID()
  const channels = ["a", "b", "cc"]

  const buf = CHANNEL_LIST_RESPONSE.create(reqid, channels)
  t.equal(cable.peekMessage(buf), constants.CHANNEL_LIST_RESPONSE, "message type should be channel list response")
  const obj = CHANNEL_LIST_RESPONSE.toJSON(buf)
  t.equal(obj.msgType, constants.CHANNEL_LIST_RESPONSE, "deserialized message type should also be channel list response")
  t.same(obj.reqid, reqid, "reqid should be same")
  t.deepEqual(obj.channels, channels, "decoded payload should be same as input")
  t.end()
})

test("7: channel list response - wrong parameters", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const channels = ["a", "b", "cc"]
  const reqid = crypto.generateReqID()
  // reqid is incorrect
  t.throws(() => {
    const buf = CHANNEL_LIST_RESPONSE.create("reqid", channels)
  }, errorPattern,"should error when passed faulty type for reqid")
  // payload is incorrect
  t.throws(() => {
    const buf = CHANNEL_LIST_RESPONSE.create(reqid, "")
  },  errorPattern, "should error when passed faulty type for posts")
  // number of arguments is incorrect
  t.throws(() => {
    const buf = CHANNEL_LIST_RESPONSE.create(crypto.generateReqID())
  },  errorPattern, "should error when missing argument")
  t.end()
})

test("2: post request", t => {
  const hashes = generateFakeHashes(4)
  const reqid = crypto.generateReqID()
  const ttl = 4

  const buf = POST_REQUEST.create(reqid, ttl, hashes)
  t.same(cable.peekMessage(buf), constants.POST_REQUEST, "msg type should be post request")
  const obj = POST_REQUEST.toJSON(buf)
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.ttl, ttl, "ttl should be same")
  t.same(obj.hashes, hashes, "hashes should be the same")
  t.same(obj.msgType, constants.POST_REQUEST, "deserialized msg type should be post request")
  t.end()
})

test("2: post request, decrement ttl", t => {
  const hashes = generateFakeHashes(4)
  const reqid = crypto.generateReqID()
  const ttl = 4

  const buf = POST_REQUEST.create(reqid, ttl, hashes)
  const newBuf = POST_REQUEST.decrementTTL(buf)
  t.same(cable.peekMessage(newBuf), constants.POST_REQUEST, "msg type should be post request")
  const obj = POST_REQUEST.toJSON(newBuf)
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.ttl, ttl - 1, "ttl should be one less than originally")
  t.same(obj.hashes, hashes, "hashes should be the same")
  t.same(obj.msgType, constants.POST_REQUEST, "deserialized msg type should be post request")
  t.end()
})

test("3: cancel request", t => {
  const reqid = crypto.generateReqID()
  const cancelid = crypto.generateReqID()
  const ttl = 0 // unused in cancel req
  const buf = CANCEL_REQUEST.create(reqid, ttl, cancelid)
  t.same(cable.peekMessage(buf), constants.CANCEL_REQUEST, "msg type should be cancel request")
  const obj = CANCEL_REQUEST.toJSON(buf)
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.cancelid, cancelid, "cancelid should be same")
  t.same(obj.msgType, constants.CANCEL_REQUEST, "deserialized msg type should be cancel request")
  t.end()
})

test("4: channel time range request", t => {
  const reqid = crypto.generateReqID()
  const channel = "default"
  const ttl = 3
  const timeStart = 0
  const timeEnd = 100
  const limit = 20

  const buf = TIME_RANGE_REQUEST.create(reqid, ttl, channel, timeStart, timeEnd, limit)
  t.same(cable.peekMessage(buf), constants.TIME_RANGE_REQUEST, "msg type should be channel time range request")
  const obj = TIME_RANGE_REQUEST.toJSON(buf)
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.msgType, constants.TIME_RANGE_REQUEST, "deserialized msg type should be channel time range request")
  t.equal(obj.timeStart, timeStart, "timeStart should be same")
  t.equal(obj.timeEnd, timeEnd, "timeEnd should be same")
  t.equal(obj.limit, limit, "limit should be same")
  t.equal(obj.channel, channel, "channel should be same")
  t.equal(obj.ttl, ttl, "ttl should be same")
  t.end()
})

test("4: channel time range request, decrement ttl", t => {
  const reqid = crypto.generateReqID()
  const channel = "default"
  const ttl = 3
  const timeStart = 0
  const timeEnd = 100
  const limit = 20

  const buf = TIME_RANGE_REQUEST.create(reqid, ttl, channel, timeStart, timeEnd, limit)
  const newBuf = TIME_RANGE_REQUEST.decrementTTL(buf)
  t.same(cable.peekMessage(newBuf), constants.TIME_RANGE_REQUEST, "msg type should be channel time range request")
  const obj = TIME_RANGE_REQUEST.toJSON(newBuf)
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.msgType, constants.TIME_RANGE_REQUEST, "deserialized msg type should be channel time range request")
  t.equal(obj.timeStart, timeStart, "timeStart should be same")
  t.equal(obj.timeEnd, timeEnd, "timeEnd should be same")
  t.equal(obj.limit, limit, "limit should be same")
  t.equal(obj.channel, channel, "channel should be same")
  t.equal(obj.ttl, ttl - 1, "ttl should be one less than originally")
  t.end()
})

test("5: channel state request", t => {
  const reqid = crypto.generateReqID()
  const channel = "default"
  const ttl = 3
  const future = 0

  const buf = CHANNEL_STATE_REQUEST.create(reqid, ttl, channel, future)
  t.same(cable.peekMessage(buf), constants.CHANNEL_STATE_REQUEST, "msg type should be channel state request")
  const obj = CHANNEL_STATE_REQUEST.toJSON(buf)
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.msgType, constants.CHANNEL_STATE_REQUEST, "deserialized msg type should be channel state request")
  t.equal(obj.channel, channel, "channel should be same")
  t.equal(obj.ttl, ttl, "ttl should be same")
  t.equal(obj.future, future, "future should be same")
  t.end()
})

test("5: channel state request, decrement ttl", t => {
  const reqid = crypto.generateReqID()
  const channel = "default"
  const ttl = 3
  const future = 0

  const buf = CHANNEL_STATE_REQUEST.create(reqid, ttl, channel, future)
  const newBuf = CHANNEL_STATE_REQUEST.decrementTTL(buf)
  t.same(cable.peekMessage(newBuf), constants.CHANNEL_STATE_REQUEST, "msg type should be channel state request")
  const obj = CHANNEL_STATE_REQUEST.toJSON(newBuf)
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.msgType, constants.CHANNEL_STATE_REQUEST, "deserialized msg type should be channel state request")
  t.equal(obj.channel, channel, "channel should be same")
  t.equal(obj.ttl, ttl - 1, "ttl should be one less than originally")
  t.equal(obj.future, future, "future should be same")
  t.end()
})

test("6: channel list request", t => {
  const reqid = crypto.generateReqID()
  const ttl = 4
  const limit = 20
  const offset = 0

  const buf = CHANNEL_LIST_REQUEST.create(reqid, ttl, offset, limit)
  const obj = CHANNEL_LIST_REQUEST.toJSON(buf)
  t.same(cable.peekMessage(buf), constants.CHANNEL_LIST_REQUEST, "msg type should be channel list request")
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.msgType, constants.CHANNEL_LIST_REQUEST, "deserialized msg type should be channel list request")
  t.equal(obj.ttl, ttl, "ttl should be same")
  t.equal(obj.offset, offset, "offset should be same")
  t.equal(obj.limit, limit, "limit should be same")
  t.end()
})

test("6: channel list request, decrement ttl", t => {
  const reqid = crypto.generateReqID()
  const ttl = 4
  const limit = 20
  const offset = 0

  const buf = CHANNEL_LIST_REQUEST.create(reqid, ttl, offset, limit)
  const newBuf = CHANNEL_LIST_REQUEST.decrementTTL(buf)
  const obj = CHANNEL_LIST_REQUEST.toJSON(newBuf)
  t.same(cable.peekMessage(newBuf), constants.CHANNEL_LIST_REQUEST, "msg type should be channel list request")
  t.same(obj.reqid, reqid, "reqid should be same")
  t.same(obj.msgType, constants.CHANNEL_LIST_REQUEST, "deserialized msg type should be channel list request")
  t.equal(obj.ttl, ttl - 1, "ttl should be one smaller than originally")
  t.equal(obj.offset, offset, "offset should be same")
  t.equal(obj.limit, limit, "limit should be same")
  t.end()
})


test("0: post/text", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(2)
  const channel = "testing-channel"
  const timestamp = 999
  const text = "test test is this thing on?"

  const buf = TEXT_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, text)
  t.equal(cable.peekPost(buf), constants.TEXT_POST, "post type should be post/text")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = TEXT_POST.toJSON(buf)
  t.equal(obj.postType, constants.TEXT_POST, "deserialized post type should be post/text")
  t.same(obj.channel, channel, "channel should be same")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.text, text, "text should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.end()
})

test("hash of post/text should work as expected", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const channel = "testing-channel"
  const timestamp = 999
  const text = "test test is this thing on?"

  const buf = TEXT_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, text)
  t.true(b4a.isBuffer(buf), "serialized cablegram should be a buffer")
  const hash = crypto.hash(buf)
  t.true(b4a.isBuffer(hash), "hashed cablegram should be a buffer")
  t.equal(hash.length, constants.HASH_SIZE, "hashed post should have correct size")
  t.end()
})

test("1: post/delete", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(2)
  const deleteHashes = generateFakeHashes(1)
  const channel = "testing-channel"
  const timestamp = 999

  const buf = DELETE_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, deleteHashes)
  t.equal(cable.peekPost(buf), constants.DELETE_POST, "post type should be post/delete")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = DELETE_POST.toJSON(buf)
  t.equal(obj.postType, constants.DELETE_POST, "deserialized post type should be post/cancel")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.hashes, deleteHashes, "hash to delete should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.end()
})

test("2: post/info (set key=name only)", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const timestamp = 999
  const key = "name"
  const value = "cable-tester"

  const buf = INFO_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, [[key, value]])
  t.equal(cable.peekPost(buf), constants.INFO_POST, "post type should be post/info")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = INFO_POST.toJSON(buf)
  t.equal(obj.postType, constants.INFO_POST, "deserialized post type should be post/info")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.true(obj.info.has(key), "key should be same")
  t.same(obj.info.get(key), value, "value should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.end()
})

test("2: post/info (set key=accept-role only)", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const timestamp = 999
  const key = "accept-role"
  const value = 0

  const buf = INFO_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, [[key, value]])
  t.equal(cable.peekPost(buf), constants.INFO_POST, "post type should be post/info")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = INFO_POST.toJSON(buf)
  t.equal(obj.postType, constants.INFO_POST, "deserialized post type should be post/info")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.true(obj.info.has(key), "key should be same")
  t.same(obj.info.get(key), value, "value should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.end()
})

test("2: post/info (set key=accept-role and key=name)", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const timestamp = 999
  const kvarr = [
    ["name", "test-person"],
    ["accept-role", 1]
  ]

  const buf = INFO_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, kvarr)
  t.equal(cable.peekPost(buf), constants.INFO_POST, "post type should be post/info")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = INFO_POST.toJSON(buf)
  t.equal(obj.postType, constants.INFO_POST, "deserialized post type should be post/info")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  for (let [key, value] of kvarr) {
    t.true(obj.info.has(key), "key should be same")
    t.same(obj.info.get(key), value, "value should be same")
  }
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.end()
})

test("3: post/topic", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const channel = "testing-channel"
  const timestamp = 999
  const topic = "the place to taste and test and taste test!"

  const buf = TOPIC_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, topic)
  t.equal(cable.peekPost(buf), constants.TOPIC_POST, "post type should be post/topic")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = TOPIC_POST.toJSON(buf)
  t.equal(obj.postType, constants.TOPIC_POST, "deserialized post type should be post/topic")
  t.same(obj.channel, channel, "channel should be same")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.topic, topic, "topic should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.end()
})

test("4: post/join", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const channel = "testing-channel"
  const timestamp = 999

  const buf = JOIN_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp)
  t.equal(cable.peekPost(buf), constants.JOIN_POST, "post type should be post/join")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = JOIN_POST.toJSON(buf)
  t.equal(obj.postType, constants.JOIN_POST, "deserialized post type should be post/join")
  t.same(obj.channel, channel, "channel should be same")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.end()
})

test("5: post/leave", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const channel = "testing-channel"
  const timestamp = 999

  const buf = LEAVE_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp)
  t.equal(cable.peekPost(buf), constants.LEAVE_POST, "post type should be post/leave")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = LEAVE_POST.toJSON(buf)
  t.equal(obj.postType, constants.LEAVE_POST, "deserialized post type should be post/leave")
  t.same(obj.channel, channel, "channel should be same")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.end()
})

test("cablegrams with same input should be identical", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const requestedPosts = [LEAVE_POST.create(keypair.publicKey, keypair.secretKey, links, "introduction", 124)]
  const reqid = crypto.generateReqID()
  const cancelid = crypto.generateReqID()
  const hashes = generateFakeHashes(3)
  const ttl = 3
  const timeStart = 0
  const timeEnd = 100
  const limit = 20
  const future = 0
  const channel = "test-channel"
  const offset = 0

  const grams = []

  grams.push(["hash response", HASH_RESPONSE.create(reqid, hashes), HASH_RESPONSE.create(reqid, hashes)])
  grams.push(["post response", POST_RESPONSE.create(reqid, requestedPosts), POST_RESPONSE.create(reqid, requestedPosts)])
  grams.push(["cancel request", CANCEL_REQUEST.create(reqid, ttl, cancelid), CANCEL_REQUEST.create(reqid, ttl, cancelid)])
  grams.push(["channel time range request", TIME_RANGE_REQUEST.create(reqid, ttl, channel, timeStart, timeEnd, limit), TIME_RANGE_REQUEST.create(reqid, ttl, channel, timeStart, timeEnd, limit)])
  grams.push(["channel state request", CHANNEL_STATE_REQUEST.create(reqid, ttl, channel, future), CHANNEL_STATE_REQUEST.create(reqid, ttl, channel, future)])
  grams.push(["channel list request", CHANNEL_LIST_REQUEST.create(reqid, ttl, offset, limit), CHANNEL_LIST_REQUEST.create(reqid, ttl, offset, limit)])

  grams.forEach(gram => {
    t.deepEqual(gram[1], gram[2], `${gram[0]} cablegram byte sequence should be identical for same inputs`)
  })
  t.end()
})
