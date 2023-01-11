const cable = require("./index.js")
const CANCEL_REQUEST = cable.CANCEL_REQUEST
const HASH_REQUEST = cable.HASH_REQUEST
const HASH_RESPONSE = cable.HASH_RESPONSE
const TIME_RANGE_REQUEST = cable.TIME_RANGE_REQUEST
const CHANNEL_STATE_REQUEST = cable.CHANNEL_STATE_REQUEST
const CHANNEL_LIST_REQUEST = cable.CHANNEL_LIST_REQUEST
const crypto = require("./cryptography.js")
const b4a = require("b4a")

function generateFakeHashes (amount) {
  const hashes = []
  for (let i = 0; i < amount; i++) {
    hashes.push(crypto.hash(crypto.generateReqID()))
  }
  return hashes
}


const b = CANCEL_REQUEST.create(crypto.generateReqID())
console.log("msg type of cancel request", cable.peek(b))
const obj = CANCEL_REQUEST.toJSON(b)
console.log(obj)

const hashes = generateFakeHashes(3)
const bufHashReq = HASH_REQUEST.create(crypto.generateReqID(), 3, hashes)
console.log("msg type of hash request", cable.peek(bufHashReq))
const objHashReq = HASH_REQUEST.toJSON(bufHashReq)
console.log(objHashReq)

const bufRangeReq = TIME_RANGE_REQUEST.create(crypto.generateReqID(), 3, "default", 0, 100, 20)
console.log("msg type of time range request", cable.peek(bufRangeReq))
const objRangeReq = TIME_RANGE_REQUEST.toJSON(bufRangeReq)
console.log(objRangeReq)

const moreHashes = generateFakeHashes(3)
const bufHashRes = HASH_RESPONSE.create(crypto.generateReqID(), moreHashes)
console.log("msg type of hash response", cable.peek(bufHashRes))
const objHashRes = HASH_RESPONSE.toJSON(bufHashRes)
console.log(objHashRes)

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
