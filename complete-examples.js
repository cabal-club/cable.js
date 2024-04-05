// SPDX-FileCopyrightText: 2023 the cable.js authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

/* 
 * outputs each request, response, and post type of the cable rev 2023-04 spec, one json object per line.
 * the json object contains the following keys:
 * {
 *   "name": the common name of the message or post type (e.g. "hash response" or "post/text"), for type
 *           "generated-data" the name is set to "initial-parameters"
 *   "type": strings used are one of:
 *     * "request": a cable request
 *     * "response": a cable response
 *     * "post": a cable post
 *     * "generated-data": outputs all the data used to generate any & all of this file's requests, responses, and posts. it is output to make it
 *                         abundantly clear what data is being used.
 *   "id": the numeric id for the message or post type (0, 1, 2....). for type "generated-data" this is -1 (not relevant)
 *   "binary": the binary representation, as according to the cable spec, for the message or post type. for type "generated-data" this is null (not relevant)
 *   "obj": an object representation of the message or post type. conventions used are camelCase over the spec's
 *        underscores, with deviations in that reqid and cancelid are all lowercase)
 * }
 *
 * NOTE: Every instance of the key "data" has as its value a serialized Uint8Array, representing binary data for its
 * parent (e.g. publicKey, hashes, reqid)
 *
*/
const b4a = require("b4a")
const crypto = require("./cryptography.js")
const constants = require("./constants")
const cable = require("./index.js")

const CANCEL_REQUEST = cable.CANCEL_REQUEST
const POST_REQUEST = cable.POST_REQUEST
const POST_RESPONSE = cable.POST_RESPONSE
const HASH_RESPONSE = cable.HASH_RESPONSE
const TIME_RANGE_REQUEST = cable.TIME_RANGE_REQUEST
const MODERATION_STATE_REQUEST = cable.MODERATION_STATE_REQUEST
const CHANNEL_STATE_REQUEST = cable.CHANNEL_STATE_REQUEST
const CHANNEL_LIST_REQUEST = cable.CHANNEL_LIST_REQUEST
const CHANNEL_LIST_RESPONSE = cable.CHANNEL_LIST_RESPONSE
const TEXT_POST = cable.TEXT_POST
const DELETE_POST = cable.DELETE_POST
const INFO_POST = cable.INFO_POST
const TOPIC_POST = cable.TOPIC_POST
const JOIN_POST = cable.JOIN_POST
const LEAVE_POST = cable.LEAVE_POST
const MODERATION_POST = cable.MODERATION_POST
const ROLE_POST = cable.ROLE_POST
const BLOCK_POST = cable.BLOCK_POST
const UNBLOCK_POST = cable.UNBLOCK_POST

// static hashes
const hashes = [
  b4a.from("20265674e8aac2dfddd78f86fe5a3dd68d976ca3f5ba23645ec7381480921d0d", "hex"),
  b4a.from("10705340e5528f2ef03a6797b72b1bb9f37f9009ad408247387c4bcc4d2a3371", "hex"),
  b4a.from("af700793dd51d4cb3c18a6df46f88bfe1665fba9b277487ddecd1e031441d69d", "hex")
]

// derived from const keypair = crypto.generateKeypair()
// and then running: print(keypair)
const keypair = {
  "publicKey": b4a.from("25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0", "hex"), 
  "secretKey": b4a.from("f12a0b72a720f9ce6898a1f4c685bee4cc838102143db98f467c5512a726e69225b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0", "hex")
}

const recipients = ["a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e91",
"2abcc76c670e32d37fd4233a6ea60fd39a3b246c4ac4bfd43a74639360ff7688",
"89d1baf8b98a135e7a9ab7720dbd809e234a61054187ed8bc1022c44e45010d6"].map(r => b4a.from(r, "hex"))
const recipient = recipients[0]

const reason = "the reason is entirely mine own"
const privacy = 0
const drop = 0
const undrop = 1
const notify = 1
const action = constants.ACTION_HIDE_USER
const role = constants.ADMIN_FLAG

const links = [crypto.hash(b4a.from("fake payload"))]
const ttl = 1
const limit = 20
const timestamp = 80
const timeStart = 0
const timeEnd = 100
const oldest = 40
const future = 0
const channels = ["default", "dev", "introduction"]
const channel = channels[0]
const username = "cabler"
const offset = 0
const text = "h€llo world"
const topic = "introduce yourself to the friendly crowd of likeminded folx"
const reqid = b4a.from("95050429", "hex") // static reqid
const cancelid = b4a.from("58b041b1", "hex") // static cancelid

// replace all Buffer instances when stringifying with Uint8Array
// function replacer(key, value) {
//   if (this.type === "Buffer") {
//     if (value === "Buffer") { return undefined }
//     return new Uint8Array(value)
//   } else {
//     return value
//   }
// }

function transformBuffer(incomingBuffer) {
  return incomingBuffer.toString("hex")
}

function traverse (coll, res) {
  Object.entries(coll).forEach(([key, value]) => {
    if (Buffer.isBuffer(value)) { 
      res[key] = transformBuffer(value)
    } else if (value && typeof value === "object") { 
      if (value instanceof Map) {
        res[key] = [...value]
      } else if (Array.isArray(value)) {
        value = traverseArray(value)
        res[key] = value
      } else {
        const obj = {}
        traverse(value, obj)
        res[key] = obj
      }
    } else {
      res[key] = value
    }
  })
}
function traverseArray (coll) {
  const arr = coll.map(item => {
    if (Buffer.isBuffer(item)) {
      return transformBuffer(item)
    } else if (item && typeof item === "object" && Array.isArray(item)) {
      return traverseArray(item)
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const obj = {}
      traverse(item, obj)
      return obj
    } else {
      return item
    }
  })
  return arr
}

function print(obj) {
  const result = {}
  const posthash = obj.binary ? b4a.toString(crypto.hash(obj.binary), "hex") : null
  obj.posthash = posthash
  traverse(obj, result)
  console.log(JSON.stringify(result))
}

print({name: "initial-parameters", type: "generated-data", id: -1, binary: null, obj: {
  keypair,
  hashes,
  reqid,
  cancelid,
  links,
  ttl,
  limit,
  timestamp,
  timeStart,
  timeEnd,
  future,
  channels,
  channel,
  username,
  offset,
  text,
  topic,
  oldest,
  recipients,
  recipient,
  action,
  role,
  reason,
  privacy,
  drop,
  undrop,
  notify
}})

/* message request types */
// 2: post request
const bufPostReq = POST_REQUEST.create(reqid, ttl, hashes)
const objPostReq = POST_REQUEST.toJSON(bufPostReq)
print({ name: "post request", type: "request", id: cable.peekMessage(bufPostReq), binary: bufPostReq, obj: objPostReq })

// 3: cancel request
const b = CANCEL_REQUEST.create(reqid, ttl, cancelid)
const obj = CANCEL_REQUEST.toJSON(b)
print({name: "cancel request", type: "request", id: cable.peekMessage(b), binary: b, obj: obj})

// 4: channel time range request
const bufRangeReq = TIME_RANGE_REQUEST.create(reqid, ttl, channel, timeStart, timeEnd, limit)
const objRangeReq = TIME_RANGE_REQUEST.toJSON(bufRangeReq)
print({name: "channel time range request", type: "request", id: cable.peekMessage(bufRangeReq), binary: bufRangeReq, obj: objRangeReq})

// 5: channel state request
const bufStateReq = CHANNEL_STATE_REQUEST.create(reqid, ttl, channel, future)
const objStateReq = CHANNEL_STATE_REQUEST.toJSON(bufStateReq)
print({ name: "channel state request", type: "request", id: cable.peekMessage(bufStateReq), binary: bufStateReq, obj: objStateReq })

// 6: channel list request
const bufListReq = CHANNEL_LIST_REQUEST.create(reqid, ttl, offset, limit)
const objListReq = CHANNEL_LIST_REQUEST.toJSON(bufListReq)
print({ name: "channel list request", type: "request", id: cable.peekMessage(bufListReq), binary: bufListReq, obj: objListReq })

// 8: moderation state request 
const bufModReq = MODERATION_STATE_REQUEST.create(reqid, ttl, channels, future, oldest)
const objModReq = MODERATION_STATE_REQUEST.toJSON(bufModReq)
print({ name: "moderation state request", type: "request", id: cable.peekMessage(bufModReq), binary: bufModReq, obj: objModReq })

/* message response types */
// 0: hash response
const bufHashRes = HASH_RESPONSE.create(reqid, hashes)
const objHashRes = HASH_RESPONSE.toJSON(bufHashRes)
print({ name: "hash response", type: "response", id: cable.peekMessage(bufHashRes), binary: bufHashRes, obj: objHashRes })

// 1: post response
const requestedData = [LEAVE_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp)]
const bufDataRes = POST_RESPONSE.create(reqid, requestedData)
const objDataRes = POST_RESPONSE.toJSON(bufDataRes)
print({ name: "post response", type: "response", id: cable.peekMessage(bufDataRes), binary: bufDataRes, obj: objDataRes })

// 7: channel list response
const bufListRes = CHANNEL_LIST_RESPONSE.create(reqid, channels)
const objListRes = CHANNEL_LIST_RESPONSE.toJSON(bufListRes)
print({ name: "channel list response", type: "response", id: cable.peekMessage(bufListRes), binary: bufListRes, obj: objListRes })

/* post types */
// 0: post/text
const bufText = TEXT_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, text)
const objText = TEXT_POST.toJSON(bufText)
print({ name: "post/text", type: "post", id: cable.peekPost(bufText), binary: bufText, obj: objText })

// 1: post/delete
const bufDelete = DELETE_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, hashes)
const objDelete = DELETE_POST.toJSON(bufDelete)
print({ name: "post/delete", type: "post", id: cable.peekPost(bufDelete), binary: bufDelete, obj: objDelete })

// 2: post/info
const bufInfo = INFO_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, [["name", username]])
const objInfo = INFO_POST.toJSON(bufInfo)
print({ name: "post/info", type: "post", id: cable.peekPost(bufInfo), binary: bufInfo, obj: objInfo })

// 3: post/topic
const bufTopic = TOPIC_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, topic)
const objTopic = TOPIC_POST.toJSON(bufTopic)
print({ name: "post/topic", type: "post", id: cable.peekPost(bufTopic), binary: bufTopic, obj: objTopic })

// 4: post/join
const bufJoin = JOIN_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp)
const objJoin = JOIN_POST.toJSON(bufJoin)
print({ name: "post/join", type: "post", id: cable.peekPost(bufJoin), binary: bufJoin, obj: objJoin })

// 5: post/leave
const bufLeave = LEAVE_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp)
const objLeave = LEAVE_POST.toJSON(bufLeave)
print({ name: "post/leave", type: "post", id: cable.peekPost(bufLeave), binary: bufLeave, obj: objLeave })

// 6: post/role
const bufRole = ROLE_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, recipient, role, reason, privacy)
const objRole = ROLE_POST.toJSON(bufRole)
print({ name: "post/role", type: "post", id: cable.peekPost(bufRole), binary: bufRole, obj: objRole })

// 7: post/moderation
const bufModeration = MODERATION_POST.create(keypair.publicKey, keypair.secretKey, links, channel, timestamp, recipients, action, reason, privacy)
const objModeration = MODERATION_POST.toJSON(bufModeration)
print({ name: "post/moderation", type: "post", id: cable.peekPost(bufModeration), binary: bufModeration, obj: objModeration })

// // 7: post/block
const bufBlock = BLOCK_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, recipients, drop, notify, reason, privacy)
const objBlock = BLOCK_POST.toJSON(bufBlock)
print({ name: "post/block", type: "post", id: cable.peekPost(bufBlock), binary: bufBlock, obj: objBlock })

// 8: post/unblock
const bufUnblock = UNBLOCK_POST.create(keypair.publicKey, keypair.secretKey, links, timestamp, recipients, undrop, reason, privacy)
const objUnblock = UNBLOCK_POST.toJSON(bufUnblock)
print({ name: "post/unblock", type: "post", id: cable.peekPost(bufUnblock), binary: bufUnblock, obj: objUnblock })
