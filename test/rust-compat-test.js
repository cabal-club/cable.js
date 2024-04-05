// SPDX-FileCopyrightText: 2023 the cable.js authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

const test = require("tape")
const cable = require("../index")
const constants = require("../constants")
const crypto = require("../cryptography")
const b4a = require("b4a")

const rust = require("./rust.json")

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

test("test passes", t => {
  t.plan(1)
  t.pass("this test always passes")
})

function bufArray2Hex (arr) {
  return arr.map(b => { return b.toString("hex") })
}

test("0: parse hash response from rust-produced binary", t => {
  const key = "hash response binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")
  const obj = HASH_RESPONSE.toJSON(buf)
  t.equal(cable.peekMessage(buf), constants.HASH_RESPONSE, "message type should be hash response")
  t.deepEqual(obj.reqid.toString("hex"), input.req_id, "reqid should be same")
  t.equal(obj.hashes.length, input.hashes.length, "hashes should be same length")
  t.deepEqual(bufArray2Hex(obj.hashes), input.hashes, "hashes should have same content")
  t.equal(obj.msgType, constants.HASH_RESPONSE, "deserialized object should have msg type for hash response")
  t.end()
})

test("1: parse post response from rust-produced binary", t => {
  const key = "post response binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")
  const obj = POST_RESPONSE.toJSON(buf)
  t.equal(cable.peekMessage(buf), constants.POST_RESPONSE, "message type should be post response")
  t.equal(obj.msgType, constants.POST_RESPONSE, "deserialized message type should also be post response")
  t.same(obj.reqid.toString("hex"), input.req_id, "reqid should be same")
  t.deepEqual(bufArray2Hex(obj.posts), input.posts, "decoded payload should be same as input")
  t.end()
})

test("7: parse channel list response from rust-produced binary", t => {
  const key = "channel list response binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = CHANNEL_LIST_RESPONSE.toJSON(buf)
  t.equal(cable.peekMessage(buf), constants.CHANNEL_LIST_RESPONSE, "message type should be channel list response")
  t.equal(obj.msgType, constants.CHANNEL_LIST_RESPONSE, "deserialized message type should also be channel list response")
  t.same(obj.reqid.toString("hex"), input.req_id, "reqid should be same")
  t.deepEqual(obj.channels, input.channels, "decoded payload should be same as input")
  t.end()
})

test("2: post request from rust-produced binary", t => {
  const key = "post request binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = POST_REQUEST.toJSON(buf)
  t.same(cable.peekMessage(buf), constants.POST_REQUEST, "msg type should be post request")
  t.same(obj.reqid.toString("hex"), input.req_id, "reqid should be same")
  t.same(obj.ttl, input.ttl, "ttl should be same")
  t.same(bufArray2Hex(obj.hashes), input.hashes, "hashes should be the same")
  t.same(obj.msgType, constants.POST_REQUEST, "deserialized msg type should be post request")
  t.end()
})

test("3: cancel request from rust-produced binary", t => {
  const key = "cancel request binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = CANCEL_REQUEST.toJSON(buf)
  t.same(cable.peekMessage(buf), constants.CANCEL_REQUEST, "msg type should be cancel request")
  t.same(obj.reqid.toString("hex"), input.req_id, "reqid should be same")
  t.same(obj.cancelid.toString("hex"), input.cancel_id, "cancelid should be same")
  t.same(obj.msgType, constants.CANCEL_REQUEST, "deserialized msg type should be cancel request")
  t.end()
})

test("4: channel time range request from rust-produced binary", t => {
  const key = "channel time range request binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = TIME_RANGE_REQUEST.toJSON(buf)
  t.same(cable.peekMessage(buf), constants.TIME_RANGE_REQUEST, "msg type should be channel time range request")
  t.same(obj.reqid.toString("hex"), input.req_id, "reqid should be same")
  t.same(obj.msgType, constants.TIME_RANGE_REQUEST, "deserialized msg type should be channel time range request")
  t.equal(obj.timeStart, input.time_start, "timeStart should be same")
  t.equal(obj.timeEnd, input.time_end, "timeEnd should be same")
  t.equal(obj.limit, input.limit, "limit should be same")
  t.equal(obj.channel, input.channel, "channel should be same")
  t.equal(obj.ttl, input.ttl, "ttl should be same")
  t.end()
})

test("5: channel state request", t => {
  const key = "channel state request binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = CHANNEL_STATE_REQUEST.toJSON(buf)
  t.same(cable.peekMessage(buf), constants.CHANNEL_STATE_REQUEST, "msg type should be channel state request")
  t.same(obj.reqid.toString("hex"), input.req_id, "reqid should be same")
  t.same(obj.msgType, constants.CHANNEL_STATE_REQUEST, "deserialized msg type should be channel state request")
  t.equal(obj.channel, input.channel, "channel should be same")
  t.equal(obj.ttl, input.ttl, "ttl should be same")
  t.equal(obj.future, input.future, "future should be same")
  t.end()
})

test("6: channel list request", t => {
  const key = "channel list request binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = CHANNEL_LIST_REQUEST.toJSON(buf)
  t.same(cable.peekMessage(buf), constants.CHANNEL_LIST_REQUEST, "msg type should be channel list request")
  t.same(obj.reqid.toString("hex"), input.req_id, "reqid should be same")
  t.same(obj.msgType, constants.CHANNEL_LIST_REQUEST, "deserialized msg type should be channel list request")
  t.equal(obj.ttl, input.ttl, "ttl should be same")
  t.equal(obj.offset, input.offset, "offset should be same")
  t.equal(obj.limit, input.limit, "limit should be same")
  t.end()
})

test("0: post/text", t => {
  const key = "text post binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = TEXT_POST.toJSON(buf)

  // make sure hashing works as intended :)
  const hash = crypto.hash(buf)
  t.true(b4a.isBuffer(hash), "hashed cablegram should be a buffer")
  t.equal(hash.length, constants.HASH_SIZE, "hashed post should have correct size")

  t.equal(cable.peekPost(buf), constants.TEXT_POST, "post type should be post/text")
  const messageSignatureCorrect = crypto.verify(buf, b4a.from(input.public_key, "hex"))
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  t.equal(obj.postType, constants.TEXT_POST, "deserialized post type should be post/text")
  t.same(obj.channel, input.channel, "channel should be same")
  t.same(obj.timestamp, input.timestamp, "timestamp should be same")
  t.same(bufArray2Hex(obj.links), input.links, "links should be same")
  t.same(obj.text, input.text, "text should be same")
  t.same(obj.publicKey.toString("hex"), input.public_key, "public key should be same")
  t.end()
})

test("1: post/delete", t => {
  const key = "delete post binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = DELETE_POST.toJSON(buf)
  t.equal(cable.peekPost(buf), constants.DELETE_POST, "post type should be post/delete")
  const messageSignatureCorrect = crypto.verify(buf, b4a.from(input.public_key, "hex"))
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  t.equal(obj.postType, constants.DELETE_POST, "deserialized post type should be post/cancel")
  t.same(obj.timestamp, input.timestamp, "timestamp should be same")
  t.same(bufArray2Hex(obj.links), input.links, "links should be same")
  t.same(bufArray2Hex(obj.hashes), input.hashes, "hash to delete should be same")
  t.same(obj.publicKey.toString("hex"), input.public_key, "public key should be same")
  t.end()
})

test("2: post/info", t => {
  const key = "info post binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = INFO_POST.toJSON(buf)
  t.equal(cable.peekPost(buf), constants.INFO_POST, "post type should be post/info")
  const messageSignatureCorrect = crypto.verify(buf, b4a.from(input.public_key, "hex"))
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  t.equal(obj.postType, constants.INFO_POST, "deserialized post type should be post/info")
  t.same(obj.timestamp, input.timestamp, "timestamp should be same")
  t.same(bufArray2Hex(obj.links), input.links, "links should be same")
  t.true(obj.info.has(input.info[0].key), "key should be same")
  t.same(obj.info.get(input.info[0].key), input.info[0].val, "value should be same")
  t.same(obj.publicKey.toString("hex"), input.public_key, "public key should be same")
  t.end()
})

test("3: post/topic", t => {
  const key = "topic post binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = TOPIC_POST.toJSON(buf)
  t.equal(cable.peekPost(buf), constants.TOPIC_POST, "post type should be post/topic")
  const messageSignatureCorrect = crypto.verify(buf, b4a.from(input.public_key, "hex"))
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  t.equal(obj.postType, constants.TOPIC_POST, "deserialized post type should be post/topic")
  t.same(obj.channel, input.channel, "channel should be same")
  t.same(obj.timestamp, input.timestamp, "timestamp should be same")
  t.same(bufArray2Hex(obj.links), input.links, "links should be same")
  t.same(obj.topic, input.topic, "topic should be same")
  t.same(obj.publicKey.toString("hex"), input.public_key, "public key should be same")
  t.end()
})

test("4: post/join", t => {
  const key = "join post binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = JOIN_POST.toJSON(buf)
  t.equal(cable.peekPost(buf), constants.JOIN_POST, "post type should be post/join")
  const messageSignatureCorrect = crypto.verify(buf, b4a.from(input.public_key, "hex"))
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  t.equal(obj.postType, constants.JOIN_POST, "deserialized post type should be post/join")
  t.same(obj.channel, input.channel, "channel should be same")
  t.same(obj.timestamp, input.timestamp, "timestamp should be same")
  t.same(bufArray2Hex(obj.links), input.links, "links should be same")
  t.same(obj.publicKey.toString("hex"), input.public_key, "public key should be same")
  t.end()
})

test("5: post/leave", t => {
  const key = "leave post binary"
  const input = rust[key.slice(0, key.length - "length".length).trim()]
  const buf = b4a.from(rust[key], "hex")  
  const obj = LEAVE_POST.toJSON(buf)
  t.equal(cable.peekPost(buf), constants.LEAVE_POST, "post type should be post/leave")
  const messageSignatureCorrect = crypto.verify(buf, b4a.from(input.public_key, "hex"))
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  t.equal(obj.postType, constants.LEAVE_POST, "deserialized post type should be post/leave")
  t.same(obj.channel, input.channel, "channel should be same")
  t.same(obj.timestamp, input.timestamp, "timestamp should be same")
  t.same(bufArray2Hex(obj.links), input.links, "links should be same")
  t.same(obj.publicKey.toString("hex"), input.public_key, "public key should be same")
  t.end()
})
