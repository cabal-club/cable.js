// SPDX-FileCopyrightText: 2023 the cabal-club authors
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

test("0: parse hash response from rust-produced binary", t => {
  const key = "hash response binary"
  const buf = b4a.from(rust[key], "hex")
  const obj = HASH_RESPONSE.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("1: parse post response from rust-produced binary", t => {
  const key = "post response binary"
  const buf = b4a.from(rust[key], "hex")
  const obj = POST_RESPONSE.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("7: parse channel list response from rust-produced binary", t => {
  const key = "channel list response binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = CHANNEL_LIST_RESPONSE.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("2: post request from rust-produced binary", t => {
  const key = "post request binary"
  const buf = b4a.from(rust[key], "hex")  
  console.log(buf)
  const obj = POST_REQUEST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("3: cancel request from rust-produced binary", t => {
  const key = "cancel request binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = CANCEL_REQUEST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("4: channel time range request from rust-produced binary", t => {
  const key = "channel time range request binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = TIME_RANGE_REQUEST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("5: channel state request", t => {
  const key = "channel state request binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = CHANNEL_STATE_REQUEST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})


test("6: channel list request", t => {
  const key = "channel list request binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = CHANNEL_LIST_REQUEST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("0: post/text", t => {
  const key = "text post binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = TEXT_POST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("1: post/delete", t => {
  const key = "delete post binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = DELETE_POST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("2: post/info", t => {
  const key = "info post binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = INFO_POST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("3: post/topic", t => {
  const key = "topic post binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = TOPIC_POST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("4: post/join", t => {
  const key = "join post binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = JOIN_POST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})

test("5: post/leave", t => {
  const key = "leave post binary"
  const buf = b4a.from(rust[key], "hex")  
  const obj = LEAVE_POST.toJSON(buf)
  t.true(buf)
  t.true(obj)
  console.log(key, obj)
  t.end()
})
