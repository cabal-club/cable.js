/* this file is not really a test bed so much as a quick & dirty playground :) */
const b4a = require("b4a")
const crypto = require("./cryptography.js")
const constants = require("./constants")
const cable = require("./index.js")

const CANCEL_REQUEST = cable.CANCEL_REQUEST
const POST_REQUEST = cable.POST_REQUEST
const POST_RESPONSE = cable.POST_RESPONSE
const HASH_RESPONSE = cable.HASH_RESPONSE
const TIME_RANGE_REQUEST = cable.TIME_RANGE_REQUEST
const CHANNEL_STATE_REQUEST = cable.CHANNEL_STATE_REQUEST
const CHANNEL_LIST_REQUEST = cable.CHANNEL_LIST_REQUEST
const CHANNEL_LIST_RESPONSE = cable.CHANNEL_LIST_RESPONSE
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

const hashes = generateFakeHashes(3)
const moreHashes = generateFakeHashes(3)
const keypair = crypto.generateKeypair()
const link = crypto.hash(b4a.from("not a message payload at all actually"))
const ttl = 1

// 3: cancel request
const cancelId = crypto.generateReqID()
const b = CANCEL_REQUEST.create(crypto.generateReqID(), ttl, cancelId)
console.log("msg type of cancel request", cable.peekMessage(b))
const obj = CANCEL_REQUEST.toJSON(b)
console.log(obj)

// 4: channel time range request
const bufRangeReq = TIME_RANGE_REQUEST.create(crypto.generateReqID(), 3, "default", 0, 100, 20)
console.log("msg type of time range request", cable.peekMessage(bufRangeReq))
const objRangeReq = TIME_RANGE_REQUEST.toJSON(bufRangeReq)
console.log(objRangeReq)

// 5: channel state request
const bufStateReq = CHANNEL_STATE_REQUEST.create(crypto.generateReqID(), 3, "dev", 0)
console.log(bufStateReq)
console.log("msg type of channel state req", cable.peekMessage(bufStateReq))
const objStateReq = CHANNEL_STATE_REQUEST.toJSON(bufStateReq)
console.log(objStateReq)

// 6: channel list request
const bufListReq = CHANNEL_LIST_REQUEST.create(crypto.generateReqID(), 3, 0, 90)
console.log(bufListReq)
console.log("msg type of channel list req", cable.peekMessage(bufListReq))
const objListReq = CHANNEL_LIST_REQUEST.toJSON(bufListReq)
console.log(objListReq)

// 0: hash response
const bufHashRes = HASH_RESPONSE.create(crypto.generateReqID(), hashes)
console.log("msg type of hash response", cable.peekMessage(bufHashRes))
console.log(bufHashRes)
const objHashRes = HASH_RESPONSE.toJSON(bufHashRes)
console.log(objHashRes)

// 1: post response
const requestedData = [LEAVE_POST.create(keypair.publicKey, keypair.secretKey, [link], "introduction", 124)]
const bufDataRes = POST_RESPONSE.create(crypto.generateReqID(), requestedData)
console.log("msg type of post response", cable.peekMessage(bufDataRes))
console.log(bufDataRes)
const objDataRes = POST_RESPONSE.toJSON(bufDataRes)
console.log(objDataRes)

// 7: channel list response
const bufListRes = CHANNEL_LIST_RESPONSE.create(crypto.generateReqID(), ["introduction", "default"])
console.log(bufListRes)
console.log("msg type of channel list response", cable.peekMessage(bufListRes))
const objListRes = CHANNEL_LIST_RESPONSE.toJSON(bufListRes)
console.log(objListRes)

// 2: hash response
const bufHashReq = POST_REQUEST.create(crypto.generateReqID(), 3, hashes)
console.log("msg type of post request", cable.peekMessage(bufHashReq))
const objHashReq = POST_REQUEST.toJSON(bufHashReq)
console.log(objHashReq)


/* post types */
// 0: post/text
const bufText = TEXT_POST.create(keypair.publicKey, keypair.secretKey, [link], "introduction", 123, "hello dar warld")
console.log("post type of post/text", cable.peekPost(bufText))
const messageSignatureCorrect = crypto.verify(bufText, keypair.publicKey)
console.log(bufText)
let correct = (messageSignatureCorrect ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrect})`)
const objText = TEXT_POST.toJSON(bufText)
console.log(objText)

// 1: post/delete
const deleteHashes = [crypto.hash(bufText)]
const bufDelete = DELETE_POST.create(keypair.publicKey, keypair.secretKey, [link], 321, deleteHashes)
console.log("post type of post/delete", cable.peekPost(bufDelete))
const messageSignatureCorrectDelete = crypto.verify(bufDelete, keypair.publicKey)
console.log(bufDelete)
correct = (messageSignatureCorrectDelete ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrectDelete})`)
const objDelete = DELETE_POST.toJSON(bufDelete)
console.log(objDelete)

// 2: post/info
const bufInfo = INFO_POST.create(keypair.publicKey, keypair.secretKey, [link], 9321, "nick", "cabler")
console.log("post type of post/info", cable.peekPost(bufInfo))
const messageSignatureCorrectInfo = crypto.verify(bufInfo, keypair.publicKey)
console.log(bufInfo)
correct = (messageSignatureCorrectInfo ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrect})`)
const objInfo = INFO_POST.toJSON(bufInfo)
console.log(objInfo)

// 3: post/topic
const bufTopic = TOPIC_POST.create(keypair.publicKey, keypair.secretKey, [link], "introduction", 123, "introduce yourself to everyone else in this channel")
console.log("post type of post/topic", cable.peekPost(bufTopic))
const messageSignatureCorrectTopic = crypto.verify(bufTopic, keypair.publicKey)
console.log(bufTopic)
correct = (messageSignatureCorrectTopic ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrectTopic})`)
const objTopic = TOPIC_POST.toJSON(bufTopic)
console.log(objTopic)

// 4: post/join
const bufJoin = JOIN_POST.create(keypair.publicKey, keypair.secretKey, [link], "introduction", 123)
console.log("post type of post/join", cable.peekPost(bufJoin))
const messageSignatureCorrectJoin = crypto.verify(bufJoin, keypair.publicKey)
console.log(bufJoin)
correct = (messageSignatureCorrectJoin ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrectJoin})`)
const objJoin = JOIN_POST.toJSON(bufJoin)
console.log(objJoin)

// 5: post/leave
const bufLeave = LEAVE_POST.create(keypair.publicKey, keypair.secretKey, [link], "introduction", 124)
console.log("post type of post/leave", cable.peekPost(bufLeave))
const messageSignatureCorrectLeave = crypto.verify(bufLeave, keypair.publicKey)
console.log(bufLeave)
correct = (messageSignatureCorrectLeave ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrectLeave})`)
const objLeave = LEAVE_POST.toJSON(bufLeave)
console.log(objLeave)
