// SPDX-FileCopyrightText: 2023 the cable.js authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

const test = require("tape")
const cable = require("../index")
const constants = require("../constants")
const crypto = require("../cryptography")
const b4a = require("b4a")

const MODERATION_STATE_REQUEST = cable.MODERATION_STATE_REQUEST
const MODERATION_POST = cable.MODERATION_POST
const ROLE_POST = cable.ROLE_POST
const BLOCK_POST = cable.BLOCK_POST
const UNBLOCK_POST = cable.UNBLOCK_POST

/*
 * exercise the following combinations in the tests:
 *
 * roles on cabal and in channel:
 * set mod   
 * set admin
 * set normal
 * 
 *
 * hide post + unhide post
 * hide user + unhide user
 * drop post + undrop post
 * drop channel + undrop channel
 *
 * 
 * block/unblock user matrix:
 *
 *          drop undrop
 * block       1 2
 * unblock     3 4
 *
 * block + notify
 *
 * moderation state request for different amounts of channels and parameters
 *
 * post/info: 
 * - change to handle multiple keys
 * - test accept-role 
 *
 * additionally - privately encrypt posts which have private: 1 set
 */

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

test("8: moderation state request", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const reqid = crypto.generateReqID()
  const channels = ["a", "b", "cc"]
  const oldest = 666
  const future = 0
  const ttl = 3

  const buf = MODERATION_STATE_REQUEST.create(reqid, ttl, channels, future, oldest)
  t.equal(cable.peekMessage(buf), constants.MODERATION_STATE_REQUEST, "message type should be moderation state request")
  const obj = MODERATION_STATE_REQUEST.toJSON(buf)
  t.equal(obj.msgType, constants.MODERATION_STATE_REQUEST, "deserialized message type should also be moderation state request")
  t.same(obj.reqid, reqid, "reqid should be same")
  t.deepEqual(obj.channels, channels, "decoded payload should be same as input")
  t.same(obj.ttl, ttl, "ttl should be same")
  t.same(obj.oldest, oldest, "oldest should be same")
  t.same(obj.future, future, "future should be same")
  t.end()
})

test("8: moderation state request - wrong parameters", t => {
  const keypair = crypto.generateKeypair()
  const links = generateFakeHashes(1)
  const reqid = crypto.generateReqID()
  const channels = ["a", "b", "cc"]
  const oldest = 666
  const future = 0
  const ttl = 3
  
  t.throws(() => {
    const buf = MODERATION_STATE_REQUEST.create("reqid", ttl, channels, future, oldest)
  }, errorPattern,"should error when passed faulty type for reqid")
  // payload is incorrect
  t.throws(() => {
    const buf = MODERATION_STATE_REQUEST.create(reqid, channels, future, oldest)
  },  errorPattern, "should error when passed faulty type for ttl")
  // ttl is missing
  t.throws(() => {
    const buf = MODERATION_STATE_REQUEST.create(reqid, ttl, "", future, oldest)
  },  errorPattern, "should error when passed faulty type for channels")
  // number of arguments is incorrect
  t.throws(() => {
    const buf = MODERATION_STATE_REQUEST.create(reqid)
  },  errorPattern, "should error when missing argument")
  // argument order is incorrect
  t.throws(() => {
    const buf = MODERATION_STATE_REQUEST.create(reqid, ttl, channels, oldest, future)
  },  errorPattern, "should error when argument order is incorrect")
  // future has incorrect value
  t.throws(() => {
    const buf = MODERATION_STATE_REQUEST.create(reqid, ttl, channels, 100, oldest)
  },  errorPattern, "should error when future has incorrect value")
  t.end()
})

test("6: post/role", t => {
  const keypair = crypto.generateKeypair()
  const recipient = crypto.generateKeypair().publicKey
  const links = generateFakeHashes(2)
  const channel = "testing-channel"
  const timestamp = 999
  const role = constants.MOD_FLAG
  const reason = "just testing moderation"
  const privacy = 0

  const buf = ROLE_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, recipient, role, reason, privacy)
  t.equal(cable.peekPost(buf), constants.ROLE_POST, "post type should be post/role")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = ROLE_POST.toJSON(buf)
  t.equal(obj.postType, constants.ROLE_POST, "deserialized post type should be post/role")
  t.same(obj.channel, channel, "channel should be same")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.role, role, "role should be same")
  t.same(obj.reason, reason, "reason should be same")
  t.same(obj.privacy, privacy, "privacy should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.same(obj.recipient, recipient, "recipient should be same")
  t.end()
})

test("hash of post/role should work as expected", t => {
  const keypair = crypto.generateKeypair()
  const recipient = crypto.generateKeypair().publicKey
  const links = generateFakeHashes(2)
  const channel = "testing-channel"
  const timestamp = 999
  const role = constants.MOD_FLAG
  const reason = "just testing moderation"
  const privacy = 0

  const buf = ROLE_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, recipient, role, reason, privacy)
  t.true(b4a.isBuffer(buf), "serialized cablegram should be a buffer")
  const hash = crypto.hash(buf)
  t.true(b4a.isBuffer(hash), "hashed cablegram should be a buffer")
  t.equal(hash.length, constants.HASH_SIZE, "hashed post should have correct size")
  t.end()
})

test("7: post/moderation", t => {
  const keypair = crypto.generateKeypair()
  const recipients = [crypto.generateKeypair().publicKey]
  const links = generateFakeHashes(2)
  const channel = "testing-channel"
  const timestamp = 999
  const action = constants.ACTION_HIDE_USER
  const reason = "just testing moderation sorrriiii"
  const privacy = 0

  const buf = MODERATION_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, recipients, action, reason, privacy)
  t.equal(cable.peekPost(buf), constants.MODERATION_POST, "post type should be post/moderation")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = MODERATION_POST.toJSON(buf)
  t.equal(obj.postType, constants.MODERATION_POST, "deserialized post type should be post/moderation")
  t.same(obj.channel, channel, "channel should be same")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.action, action, "action should be same")
  t.same(obj.reason, reason, "reason should be same")
  t.same(obj.privacy, privacy, "privacy should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.deepEqual(obj.recipients, recipients, "recipients should be same")
  t.end()
})

test("7: post/moderation (all action alternatives)", t => {
  const keypair = crypto.generateKeypair()
  const recipients = [crypto.generateKeypair().publicKey]
  const links = generateFakeHashes(2)
  const channel = "testing-channel"
  const timestamp = 999
  const reason = "just testing moderation sorrriiii"
  const privacy = 0
  const actions = [
    constants.ACTION_HIDE_USER, 
    constants.ACTION_UNHIDE_USER,
    constants.ACTION_HIDE_POST,       
    constants.ACTION_UNHIDE_POST,
    constants.ACTION_DROP_POST,    
    constants.ACTION_UNDROP_POST,
    constants.ACTION_DROP_CHANNEL,
    constants.ACTION_UNDROP_CHANNEL  
  ]
  for (action of actions) {
    // add some test flavor text
    switch (action) {
      case constants.ACTION_HIDE_USER:
        t.comment("action: hide user")
        break
      case constants.ACTION_UNHIDE_USER:
        t.comment("action: unhide user")
        break
      case constants.ACTION_DROP_POST:
        t.comment("action: drop post")
        break
      case constants.ACTION_UNDROP_POST:
        t.comment("action: undrop post")
        break
      case constants.ACTION_HIDE_POST:     
        t.comment("action: hide post")
        break
      case constants.ACTION_UNHIDE_POST:
        t.comment("action: unhide post")
        break
      case constants.ACTION_DROP_CHANNEL:
        t.comment("action: drop channel")
        break
      case constants.ACTION_UNDROP_CHANNEL:
        t.comment("action: undrop channel")
        break
    }
    // conditionally tweak the recipients depending on which type of action it is
    let recps
    switch (action) {
      case constants.ACTION_HIDE_USER:
      case constants.ACTION_UNHIDE_USER:
        recps = recipients
        break
      case constants.ACTION_DROP_POST:
      case constants.ACTION_UNDROP_POST:
      case constants.ACTION_HIDE_POST:     
      case constants.ACTION_UNHIDE_POST:
        recps = generateFakeHashes(1)
        break
      case constants.ACTION_DROP_CHANNEL:
      case constants.ACTION_UNDROP_CHANNEL:
        recps = []
        break
    }
    const buf = MODERATION_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, recps, action, reason, privacy)
    t.equal(cable.peekPost(buf), constants.MODERATION_POST, "post type should be post/moderation")
    const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
    t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
    const obj = MODERATION_POST.toJSON(buf)
    t.equal(obj.postType, constants.MODERATION_POST, "deserialized post type should be post/moderation")
    t.same(obj.channel, channel, "channel should be same")
    t.same(obj.timestamp, timestamp, "timestamp should be same")
    t.same(obj.links, links, "links should be same")
    t.same(obj.action, action, "action should be same")
    t.same(obj.reason, reason, "reason should be same")
    t.same(obj.privacy, privacy, "privacy should be same")
    t.same(obj.publicKey, keypair.publicKey, "public key should be same")
    t.deepEqual(obj.recipients, recps, "recipients should be same")
  }
  t.end()
})

test("8: post/block", t => {
  const keypair = crypto.generateKeypair()
  const recipients = [crypto.generateKeypair().publicKey]
  const links = generateFakeHashes(2)
  const timestamp = 999
  const drop = 1
  const notify = 1
  const reason = "just testing block sorrriiii"
  const privacy = 0

  const buf = BLOCK_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, recipients, drop, notify, reason, privacy)
  t.equal(cable.peekPost(buf), constants.BLOCK_POST, "post type should be post/block")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = BLOCK_POST.toJSON(buf)
  t.equal(obj.postType, constants.BLOCK_POST, "deserialized post type should be post/block")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.drop, drop, "drop should be same")
  t.same(obj.notify, notify, "notify should be same")
  t.same(obj.reason, reason, "reason should be same")
  t.same(obj.privacy, privacy, "privacy should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.deepEqual(obj.recipients, recipients, "recipients should be same")
  t.end()
})

test("8: post/unblock", t => {
  const keypair = crypto.generateKeypair()
  const recipients = [crypto.generateKeypair().publicKey]
  const links = generateFakeHashes(2)
  const timestamp = 999
  const undrop = 1
  const reason = "just testing unblock"
  const privacy = 0

  const buf = UNBLOCK_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, recipients, undrop, reason, privacy)
  t.equal(cable.peekPost(buf), constants.UNBLOCK_POST, "post type should be post/unblock")
  const messageSignatureCorrect = crypto.verify(buf, keypair.publicKey)
  t.true(messageSignatureCorrect, "embedded cryptographic signature should be valid")
  const obj = UNBLOCK_POST.toJSON(buf)
  t.equal(obj.postType, constants.UNBLOCK_POST, "deserialized post type should be post/unblock")
  t.same(obj.timestamp, timestamp, "timestamp should be same")
  t.same(obj.links, links, "links should be same")
  t.same(obj.undrop, undrop, "undrop should be same")
  t.same(obj.reason, reason, "reason should be same")
  t.same(obj.privacy, privacy, "privacy should be same")
  t.same(obj.publicKey, keypair.publicKey, "public key should be same")
  t.deepEqual(obj.recipients, recipients, "recipients should be same")
  t.end()
})
