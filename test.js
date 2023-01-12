const cable = require("./index.js")
const constants = require("./constants")
const CANCEL_REQUEST = cable.CANCEL_REQUEST
const HASH_REQUEST = cable.HASH_REQUEST
const DATA_RESPONSE = cable.DATA_RESPONSE
const HASH_RESPONSE = cable.HASH_RESPONSE
const TIME_RANGE_REQUEST = cable.TIME_RANGE_REQUEST
const CHANNEL_STATE_REQUEST = cable.CHANNEL_STATE_REQUEST
const CHANNEL_LIST_REQUEST = cable.CHANNEL_LIST_REQUEST
const TEXT_POST = cable.TEXT_POST
const DELETE_POST = cable.DELETE_POST
const INFO_POST = cable.INFO_POST
const TOPIC_POST = cable.TOPIC_POST
const JOIN_POST = cable.JOIN_POST
const LEAVE_POST = cable.LEAVE_POST
const crypto = require("./cryptography.js")
const b4a = require("b4a")

function generateFakeHashes (amount) {
  const hashes = []
  for (let i = 0; i < amount; i++) {
    hashes.push(crypto.hash(crypto.generateReqID()))
  }
  return hashes
}

function generateFakeData (amount) {
  let data = []
  for (let i = 0; i < amount; i++) {
    data.push(b4a.from("abc".repeat(Math.floor(Math.random()*50))))
  }
  return data
}

const hashes = generateFakeHashes(3)
const moreHashes = generateFakeHashes(3)
const fakeData = generateFakeData(5)

const bufHashRes = HASH_RESPONSE.create(crypto.generateReqID(), moreHashes)
console.log("msg type of hash response", cable.peek(bufHashRes))
const objHashRes = HASH_RESPONSE.toJSON(bufHashRes)
console.log(objHashRes)

const bufDataRes = DATA_RESPONSE.create(crypto.generateReqID(), fakeData)
console.log("msg type of data response", cable.peek(bufDataRes))
console.log(bufDataRes)
const objDataRes = DATA_RESPONSE.toJSON(bufDataRes)
console.log(objDataRes)
// for (let i = 0; i < fakeData.length; i++) {
//   console.log(fakeData[i].toString() === objDataRes.data[i].toString())
//   console.log("a", fakeData[i].toString())
//   console.log("b", objDataRes.data[i].toString())
// }

const bufHashReq = HASH_REQUEST.create(crypto.generateReqID(), 3, hashes)
console.log("msg type of hash request", cable.peek(bufHashReq))
const objHashReq = HASH_REQUEST.toJSON(bufHashReq)
console.log(objHashReq)

const b = CANCEL_REQUEST.create(crypto.generateReqID())
console.log("msg type of cancel request", cable.peek(b))
const obj = CANCEL_REQUEST.toJSON(b)
console.log(obj)

const bufRangeReq = TIME_RANGE_REQUEST.create(crypto.generateReqID(), 3, "default", 0, 100, 20)
console.log("msg type of time range request", cable.peek(bufRangeReq))
const objRangeReq = TIME_RANGE_REQUEST.toJSON(bufRangeReq)
console.log(objRangeReq)

const bufStateReq = CHANNEL_STATE_REQUEST.create(crypto.generateReqID(), 3, "dev", 12, 9)
console.log(bufStateReq)
console.log("msg type of channel state req", cable.peek(bufStateReq))
const objStateReq = CHANNEL_STATE_REQUEST.toJSON(bufStateReq)
console.log(objStateReq)

const bufListReq = CHANNEL_LIST_REQUEST.create(crypto.generateReqID(), 3, 90)
console.log(bufListReq)
console.log("msg type of channel list req", cable.peek(bufListReq))
const objListReq = CHANNEL_LIST_REQUEST.toJSON(bufListReq)
console.log(objListReq)

/* giving post/* post types a spin */
const keypair = crypto.generateKeypair()

const link = crypto.hash(b4a.from("not a message payload at all actually"))
const bufText = TEXT_POST.create(keypair.publicKey, keypair.secretKey, link, "introduction", 123, "hello dar warld")
const sigAndPayload = bufText.slice(constants.PUBLICKEY_SIZE)
const payload = bufText.slice(constants.PUBLICKEY_SIZE + constants.SIGNATURE_SIZE)
const messageSignatureCorrect = crypto.verify(sigAndPayload, payload, keypair.publicKey)
console.log(bufText)
let correct = (messageSignatureCorrect ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrect})`)
const objText = TEXT_POST.toJSON(bufText)
console.log(objText)

const deleteHash = crypto.hash(bufText)
const bufDelete = DELETE_POST.create(keypair.publicKey, keypair.secretKey, link, 321, deleteHash)
const sigAndPayloadDelete = bufDelete.slice(constants.PUBLICKEY_SIZE)
const payloadDelete = bufDelete.slice(constants.PUBLICKEY_SIZE + constants.SIGNATURE_SIZE)
const messageSignatureCorrectDelete = crypto.verify(sigAndPayloadDelete, payloadDelete, keypair.publicKey)
console.log(bufDelete)
correct = (messageSignatureCorrectDelete ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrectDelete})`)
const objDelete = DELETE_POST.toJSON(bufDelete)
console.log(objDelete)

const bufInfo = INFO_POST.create(keypair.publicKey, keypair.secretKey, link, 9321, "nick", "cabler")
const sigAndPayloadInfo = bufInfo.slice(constants.PUBLICKEY_SIZE)
const payloadInfo = bufInfo.slice(constants.PUBLICKEY_SIZE + constants.SIGNATURE_SIZE)
const messageSignatureCorrectInfo = crypto.verify(sigAndPayloadInfo, payloadInfo, keypair.publicKey)
console.log(bufInfo)
correct = (messageSignatureCorrectInfo ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrect})`)
const objInfo = INFO_POST.toJSON(bufInfo)
console.log(objInfo)

const bufTopic = TOPIC_POST.create(keypair.publicKey, keypair.secretKey, link, "introduction", 123, "introduce yourself to everyone else in this channel")
const sigAndPayloadTopic = bufTopic.slice(constants.PUBLICKEY_SIZE)
const payloadTopic = bufTopic.slice(constants.PUBLICKEY_SIZE + constants.SIGNATURE_SIZE)
const messageSignatureCorrectTopic = crypto.verify(sigAndPayloadTopic, payloadTopic, keypair.publicKey)
console.log(bufTopic)
correct = (messageSignatureCorrectTopic ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrectTopic})`)
const objTopic = TOPIC_POST.toJSON(bufTopic)
console.log(objTopic)

const bufJoin = JOIN_POST.create(keypair.publicKey, keypair.secretKey, link, "introduction", 123)
const sigAndPayloadJoin = bufJoin.slice(constants.PUBLICKEY_SIZE)
const payloadJoin = bufJoin.slice(constants.PUBLICKEY_SIZE + constants.SIGNATURE_SIZE)
const messageSignatureCorrectJoin = crypto.verify(sigAndPayloadJoin, payloadJoin, keypair.publicKey)
console.log(bufJoin)
correct = (messageSignatureCorrectJoin ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrectJoin})`)
const objJoin = JOIN_POST.toJSON(bufJoin)
console.log(objJoin)

const bufLeave = LEAVE_POST.create(keypair.publicKey, keypair.secretKey, link, "introduction", 124)
const sigAndPayloadLeave = bufLeave.slice(constants.PUBLICKEY_SIZE)
const payloadLeave = bufLeave.slice(constants.PUBLICKEY_SIZE + constants.SIGNATURE_SIZE)
const messageSignatureCorrectLeave = crypto.verify(sigAndPayloadLeave, payloadLeave, keypair.publicKey)
console.log(bufLeave)
correct = (messageSignatureCorrectLeave ? "correct" : "incorrect")
console.log("and the message is....", correct, `(${messageSignatureCorrectLeave})`)
const objLeave = LEAVE_POST.toJSON(bufLeave)
console.log(objLeave)
