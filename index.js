// all uses of "buffer" refer to the structure represented by b4a: 
// i.e. a nodejs buffer if running nodejs, or a Uint8Array in the web
const b4a = require("b4a")
const constants = require("./constants.js")
const varint = require("varint")
const crypto = require("./cryptography.js")

// TODO (2023-01-10):
// * in the create methods: improve their resiliency by detecting when the pre-allocated buffer will not be large enough, and reallocatIe a larger buffer
// * reserve 4 bytes between `req_id` and `ttl`
//  in requests, and also in responses after `req_id` for circuits

// TODO (2023-01-11): regarding byte size of a string
// is it enough to simply do str.length to get the correct byte size? any gotchas?

// TODO (2023-01-11): 
// would like to abstract away `offset += varint.decode.bytes` in case we swap library / opt for self-authored standard

const HASHES_EXPECTED = new Error("expected hashes to contain an array of hash-sized buffers")
const STRINGS_EXPECTED = new Error("expected channels to contain an array of strings")
function bufferExpected (param, size) {
  return new Error(`expected ${param} to be a buffer of size ${size}`)
}
function integerExpected (param) {
  return new Error(`expected ${param} to be an integer`)
}
function stringExpected (param) {
  return new Error(`expected ${param} to be a string`)
}

function wrongNumberArguments(count, actual, functionSignature) {
 return new Error(`${functionSignature} expected ${count} arguments but received ${actual}`) 
}

class HASH_RESPONSE {
  static create(reqid, hashes) {
    if (arguments.length !== 2) { throw wrongNumberArguments(2, arguments.length, "create(reqid, hashes)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }
    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.HASH_RESPONSE, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, offset)
    // 3. write amount of hashes (hash_count varint)
    offset += writeVarint(hashes.length, frame, offset)
    // 4. write the hashes themselves
    hashes.forEach(hash => {
      offset += hash.copy(frame, offset)
    })
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, hashes }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.HASH_RESPONSE) {
      throw new Error("decoded msgType is not of expected type (constants.HASH_RESPONSE)")
    }
    // 3. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
    // 4. get hashCount
    const hashCount = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. use hashCount to slice out the hashes
    let hashes = []
    for (let i = 0; i < hashCount; i++) {
      hashes.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    return { msgLen, msgType, reqid, hashes }
  }
}

class DATA_RESPONSE {
  static create(reqid, arrdata) {
    if (arguments.length !== 2) { throw wrongNumberArguments(2, arguments.length, "create(reqid, arrdata)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isArrayData(arrdata)) { throw new Error(`expected data to be a buffer`) }
    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.DATA_RESPONSE, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, offset)
    // 3. exhaust array of data
    for (let i = 0; i < arrdata.length; i++) {
      // 3.1 write dataLen 
      offset += writeVarint(arrdata[i].length, frame, offset)
      // 3.2 then write the data itself
      offset += arrdata[i].copy(frame, offset)
    }
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, data}
  static toJSON(buf) {
    let offset = 0
    let msgLenBytes
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    msgLenBytes = varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.DATA_RESPONSE) {
      throw new Error("decoded msgType is not of expected type (constants.DATA_RESPONSE)")
    }
    // 3. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
    // 4. remaining buffer consists of [dataLen, data] segments
    // read until it runs out
    let data = []
    // msgLen tells us the number of bytes in the remaining cablegram i.e. *excluding* msgLen, 
    // so we need to account for that by adding msgLenBytes
    let remaining = msgLen - offset + msgLenBytes
    while (remaining > 0) {
      const dataLen = decodeVarintSlice(buf, offset)
      offset += varint.decode.bytes
      // 5. use dataLen to slice out the hashes
      data.push(buf.subarray(offset, offset + dataLen))
      offset += dataLen
      
      remaining = msgLen - offset + msgLenBytes
    }

    return { msgLen, msgType, reqid, data }
  }
}

class HASH_REQUEST {
  // constructs a cablegram buffer using the incoming arguments
  static create(reqid, ttl, hashes) {
    if (arguments.length !== 3) { throw wrongNumberArguments(3, arguments.length, "create(reqid, ttl, hashes)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.HASH_REQUEST, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, offset)
    // 3. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 4. write amount of hashes (hash_count varint)
    offset += writeVarint(hashes.length, frame, offset)
    // 5. write the hashes themselves
    hashes.forEach(hash => {
      offset += hash.copy(frame, offset)
    })
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }

  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, hashes }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.HASH_REQUEST) {
      throw new Error("decoded msgType is not of expected type (constants.HASH_REQUEST)")
    }
    // 3. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
    // 4. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. get hashCount
    const hashCount = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use hashCount to slice out the hashes
    let hashes = []
    for (let i = 0; i < hashCount; i++) {
      hashes.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    return { msgLen, msgType, reqid, ttl, hashes }
  }

  static decrementTTL(buf) {
    return insertNewTTL(buf, constants.HASH_REQUEST)
  }
}

class CANCEL_REQUEST {
  // constructs a cablegram buffer using the incoming arguments
  static create(reqid) {
    if (arguments.length !== 1) { throw wrongNumberArguments(1, arguments.length, "create(reqid)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CANCEL_REQUEST, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, varint.encode.bytes)

    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }

  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid }
  static toJSON(buf) {
    let offset = 0
    // 1. get mshLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CANCEL_REQUEST) {
      throw new Error("decoded msgType is not of expected type (constants.CANCEL_REQUEST)")
    }
    // 3. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE

    return { msgLen, msgType, reqid }
  }
}

class TIME_RANGE_REQUEST {
  static create(reqid, ttl, channel, timeStart, timeEnd, limit) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(reqid, ttl, channel, timeStart, timeEnd, limit)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timeStart)) { throw integerExpected("timeStart") }
    if (!isInteger(timeEnd)) { throw integerExpected("timeEnd") }
    if (!isInteger(limit)) { throw integerExpected("limit") }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.TIME_RANGE_REQUEST, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, offset)
    // 3. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 4. write channel_size
    offset += writeVarint(channel.length, frame, offset)
    // 5. write the channel
    offset += b4a.from(channel).copy(frame, offset)
    // 6. write time_start
    offset += writeVarint(timeStart, frame, offset)
    // 7. write time_end
    offset += writeVarint(timeEnd, frame, offset)
    // 8. write limit
    offset += writeVarint(limit, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, channel, timeStart, timeEnd, limit }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.TIME_RANGE_REQUEST) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.TIME_RANGE_REQUEST)`)
    }
    // 3. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    // 4. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. get channelSize
    const channelSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use channelSize to slice out the channel
    const channel = buf.subarray(offset, offset + channelSize).toString()
    offset += channelSize
    // 7. get timeStart
    const timeStart = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. get timeEnd
    const timeEnd = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 9. get limit
    const limit = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { msgLen, msgType, reqid, ttl, channel, timeStart, timeEnd, limit }
  }

  static decrementTTL(buf) {
    return insertNewTTL(buf, constants.TIME_RANGE_REQUEST)
  }
}

class CHANNEL_STATE_REQUEST {
  static create(reqid, ttl, channel, limit, updates) {
    if (arguments.length !== 5) { throw wrongNumberArguments(5, arguments.length, "create(reqid, ttl, channel, limit, updates)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(limit)) { throw integerExpected("limit") }
    if (!isInteger(updates)) { throw integerExpected("updates") }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CHANNEL_STATE_REQUEST, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, offset)
    // 3. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 4. write channel_size
    offset += writeVarint(channel.length, frame, offset)
    // 5. write the channel
    offset += b4a.from(channel).copy(frame, offset)
    // 6. write limit 
    offset += writeVarint(limit, frame, offset)
    // 7. write updates
    offset += writeVarint(updates, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, channel, limit, updates }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CHANNEL_STATE_REQUEST) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.CHANNEL_STATE_REQUEST)`)
    }
    // 3. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 4. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. get channelSize
    const channelSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use channelSize to slice out channel
    const channel = buf.subarray(offset, offset + channelSize).toString()
    offset += channelSize
    // 7. get limit
    const limit = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. get updates
    const updates = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { msgLen, msgType, reqid, ttl, channel, limit, updates }
  }

  static decrementTTL(buf) {
    return insertNewTTL(buf, constants.CHANNEL_STATE_REQUEST)
  }
}

class CHANNEL_LIST_REQUEST {
  static create(reqid, ttl, argOffset, limit) {
    if (arguments.length !== 4) { throw wrongNumberArguments(4, arguments.length, "create(reqid, ttl, offset, limit)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!isInteger(argOffset)) { throw integerExpected("offset") }
    if (!isInteger(limit)) { throw integerExpected("limit") }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CHANNEL_LIST_REQUEST, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, offset)
    // 3. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 4. write offset 
    offset += writeVarint(argOffset, frame, offset)
    // 5. write limit 
    offset += writeVarint(limit, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, limit }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CHANNEL_LIST_REQUEST) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.CHANNEL_LIST_REQUEST)`)
    }
    // 3. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 4. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. get offset
    const argOffset = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. get limit
    const limit = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { msgLen, msgType, reqid, ttl, offset: argOffset, limit }
  }

  static decrementTTL(buf) {
    return insertNewTTL(buf, constants.CHANNEL_LIST_REQUEST)
  }
}

class CHANNEL_LIST_RESPONSE {
  static create(reqid, channels) {
    if (arguments.length !== 2) { throw wrongNumberArguments(2, arguments.length, "create(reqid, channels)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isArrayString(channels)) { throw STRINGS_EXPECTED }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CHANNEL_LIST_RESPONSE, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, offset)
    // 3. write channels
    channels.forEach(channel => {
      offset += writeVarint(channel.length, frame, offset)
      offset += b4a.from(channel).copy(frame, offset)
    })
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, channels }
  static toJSON(buf) {
    let offset = 0
    let msgLenBytes 
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    msgLenBytes = varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CHANNEL_LIST_RESPONSE) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.CHANNEL_LIST_RESPONSE)`)
    }
    // 3. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 4. get channels
    const channels = []
    // msgLen tells us the number of bytes in the remaining cablegram i.e. *excluding* msgLen, 
    // so we need to account for that by adding msgLenBytes
    let remaining = msgLen - offset + msgLenBytes
    while (remaining > 0) {
    // get channel size
      const channelLen = decodeVarintSlice(buf, offset)
      offset += varint.decode.bytes
      // 5. use dataLen to slice out the hashes
      channels.push(buf.subarray(offset, offset + channelLen).toString())
      offset += channelLen
      remaining = msgLen - offset + msgLenBytes
    }

    return { msgLen, msgType, reqid, channels }
  }

  static decrementTTL(buf) {
    return insertNewTTL(buf, constants.CHANNEL_LIST_REQUEST)
  }
}

class TEXT_POST {
  static create(publicKey, secretKey, link, channel, timestamp, text) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(publicKey, secretKey, link, channel, timestamp, text)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isBufferSize(link, constants.HASH_SIZE)) { throw bufferExpected("link", constants.HASH_SIZE) }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isString(text)) { throw stringExpected("text") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write link, which is represents a hash i.e. a buffer
    offset += link.copy(buf, offset)
    // 4. write postType
    offset += writeVarint(constants.TEXT_POST, buf, offset)
    // 5. write channelSize
    offset += writeVarint(channel.length, buf, offset)
    // 6. write the channel
    offset += b4a.from(channel).copy(buf, offset)
    // 7. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 8. write textSize
    offset += writeVarint(text.length, buf, offset)
    // 9. write the text
    offset += b4a.from(text).copy(buf, offset)

    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    const signatureCorrect = crypto.verify(message, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, link, postType, channel, timestamp, text }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    const signatureCorrect = crypto.verify(buf, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }
    // 3. get link
    const link = buf.subarray(offset, offset + constants.HASH_SIZE)
    offset += constants.HASH_SIZE
    // 4. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.TEXT_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.TEXT_POST)`)
    }
    // 5. get channelSize
    const channelSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use channelSize to get channel
    const channel = buf.subarray(offset, offset + channelSize).toString()
    offset += channelSize
    // 7. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. get textSize
    const textSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 9. use textSize to get text
    const text = buf.subarray(offset, offset + textSize).toString()
    offset += textSize

    return { publicKey, signature, link, postType, channel, timestamp, text }
  }
}

class DELETE_POST {
  static create(publicKey, secretKey, link, timestamp, hash) {
    if (arguments.length !== 5) { throw wrongNumberArguments(5, arguments.length, "create(publicKey, secretKey, link, timestamp, hash)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isBufferSize(link, constants.HASH_SIZE)) { throw bufferExpected("link", constants.HASH_SIZE) }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isBufferSize(hash, constants.HASH_SIZE)) { throw bufferExpected("hash", constants.HASH_SIZE) }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write link, which is represents a hash i.e. a buffer
    offset += link.copy(buf, offset)
    // 4. write postType
    offset += writeVarint(constants.DELETE_POST, buf, offset)
    // 5. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 6. write hash, which represents the hash of the post we are requesting peers to delete
    offset += hash.copy(buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    const signatureCorrect = crypto.verify(message, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, link, postType, timestamp, hash }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    const signatureCorrect = crypto.verify(buf, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }
    // 3. get link
    const link = buf.subarray(offset, offset + constants.HASH_SIZE)
    offset += constants.HASH_SIZE
    // 4. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.DELETE_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.DELETE_POST)`)
    }
    // 5. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. get hash
    const hash = buf.subarray(offset, offset + constants.HASH_SIZE)
    offset += constants.HASH_SIZE

    return { publicKey, signature, link, postType, timestamp, hash }
  }
}
  
// intentionally left blank; will loop back to
class INFO_POST {
  static create(publicKey, secretKey, link, timestamp, key, value) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(publicKey, secretKey, link, timestamp, key, value)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isBufferSize(link, constants.HASH_SIZE)) { throw bufferExpected("link", constants.HASH_SIZE) }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isString(key)) { throw stringExpected("key") }
    if (!isString(value)) { throw stringExpected("value") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write link, which is represents a hash i.e. a buffer
    offset += link.copy(buf, offset)
    // 4. write postType
    offset += writeVarint(constants.INFO_POST, buf, offset)
    // 7. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 5. write keySize
    offset += writeVarint(key.length, buf, offset)
    // 6. write the key
    offset += b4a.from(key).copy(buf, offset)
    // 8. write valueSize
    offset += writeVarint(value.length, buf, offset)
    // 9. write the value
    offset += b4a.from(value).copy(buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    const signatureCorrect = crypto.verify(message, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, link, postType, timestamp, key, value }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    const signatureCorrect = crypto.verify(buf, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }
    // 3. get link
    const link = buf.subarray(offset, offset + constants.HASH_SIZE)
    offset += constants.HASH_SIZE
    // 4. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.INFO_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.INFO_POST)`)
    }
    // 5. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. get keySize
    const keySize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. use keySize to get key
    const key = buf.subarray(offset, offset + keySize).toString()
    offset += keySize
    // 8. get valueSize
    const valueSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 9. use valueSize to get value
    const value = buf.subarray(offset, offset + valueSize).toString()
    offset += valueSize

    return { publicKey, signature, link, postType, timestamp, key, value }
  }
}


class TOPIC_POST {
  static create(publicKey, secretKey, link, channel, timestamp, topic) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(publicKey, secretKey, link, channel, timestamp, topic)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isBufferSize(link, constants.HASH_SIZE)) { throw bufferExpected("link", constants.HASH_SIZE) }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isString(topic)) { throw stringExpected("topic") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write link, which is represents a hash i.e. a buffer
    offset += link.copy(buf, offset)
    // 4. write postType
    offset += writeVarint(constants.TOPIC_POST, buf, offset)
    // 5. write channelSize
    offset += writeVarint(channel.length, buf, offset)
    // 6. write the channel
    offset += b4a.from(channel).copy(buf, offset)
    // 7. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 8. write topicSize
    offset += writeVarint(topic.length, buf, offset)
    // 9. write the topic
    offset += b4a.from(topic).copy(buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    const signatureCorrect = crypto.verify(message, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, link, postType, channel, timestamp, topic }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    const signatureCorrect = crypto.verify(buf, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }
    // 3. get link
    const link = buf.subarray(offset, offset + constants.HASH_SIZE)
    offset += constants.HASH_SIZE
    // 4. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.TOPIC_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.TOPIC_POST)`)
    }
    // 5. get channelSize
    const channelSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use channelSize to get channel
    const channel = buf.subarray(offset, offset + channelSize).toString()
    offset += channelSize
    // 7. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. get topicSize
    const topicSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 9. use topicSize to get topic
    const topic = buf.subarray(offset, offset + topicSize).toString()
    offset += topicSize

    return { publicKey, signature, link, postType, channel, timestamp, topic }
  }
}

class JOIN_POST {
  static create(publicKey, secretKey, link, channel, timestamp) {
    if (arguments.length !== 5) { throw wrongNumberArguments(5, arguments.length, "create(publicKey, secretKey, link, channel, timestamp)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isBufferSize(link, constants.HASH_SIZE)) { throw bufferExpected("link", constants.HASH_SIZE) }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write link, which is represents a hash i.e. a buffer
    offset += link.copy(buf, offset)
    // 4. write postType
    offset += writeVarint(constants.JOIN_POST, buf, offset)
    // 5. write channelSize
    offset += writeVarint(channel.length, buf, offset)
    // 6. write the channel
    offset += b4a.from(channel).copy(buf, offset)
    // 7. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    const signatureCorrect = crypto.verify(message, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, link, postType, channel, timestamp }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    const signatureCorrect = crypto.verify(buf, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }
    // 3. get link
    const link = buf.subarray(offset, offset + constants.HASH_SIZE)
    offset += constants.HASH_SIZE
    // 4. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.JOIN_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.JOIN_POST)`)
    }
    // 5. get channelSize
    const channelSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use channelSize to get channel
    const channel = buf.subarray(offset, offset + channelSize).toString()
    offset += channelSize
    // 7. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { publicKey, signature, link, postType, channel, timestamp }
  }
}

class LEAVE_POST {
  static create(publicKey, secretKey, link, channel, timestamp) {
    if (arguments.length !== 5) { throw wrongNumberArguments(5, arguments.length, "create(publicKey, secretKey, link, channel, timestamp)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isBufferSize(link, constants.HASH_SIZE)) { throw bufferExpected("link", constants.HASH_SIZE) }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write link, which is represents a hash i.e. a buffer
    offset += link.copy(buf, offset)
    // 4. write postType
    offset += writeVarint(constants.LEAVE_POST, buf, offset)
    // 5. write channelSize
    offset += writeVarint(channel.length, buf, offset)
    // 6. write the channel
    offset += b4a.from(channel).copy(buf, offset)
    // 7. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    const signatureCorrect = crypto.verify(message, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, link, postType, channel, timestamp }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    const signatureCorrect = crypto.verify(buf, publicKey)
    if (!signatureCorrect) { 
      throw new Error("could not verify created signature using keypair publicKey + secretKey") 
    }
    // 3. get link
    const link = buf.subarray(offset, offset + constants.HASH_SIZE)
    offset += constants.HASH_SIZE
    // 4. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.LEAVE_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.LEAVE_POST)`)
    }
    // 5. get channelSize
    const channelSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use channelSize to get channel
    const channel = buf.subarray(offset, offset + channelSize).toString()
    offset += channelSize
    // 7. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { publicKey, signature, link, postType, channel, timestamp }
  }
}


// peek returns the buf type of a cablegram
function peek (buf) {
  // decode msg len, and discard
  decodeVarintSlice(buf, 0)
  const offset = varint.decode.bytes
  // decode and return msg type
  return decodeVarintSlice(buf, offset)
}

function peekReqid (buf) {
  // decode msg len, and discard
  decodeVarintSlice(buf, 0)
  let offset = varint.decode.bytes
  // decode msg type and discard
  decodeVarintSlice(buf, offset)
  offset += varint.decode.bytes
  // read & return reqid
  return buf.subarray(offset, offset+constants.REQID_SIZE)
}

// peek a buffer containing a cable post and return its post type
function peekPost (buf) {
  const offset = constants.PUBLICKEY_SIZE + constants.SIGNATURE_SIZE + constants.HASH_SIZE
  return decodeVarintSlice(buf, offset)
}

function parsePost (buf) {
  const postType = peekPost(buf)
  let obj
  switch (postType) {
    case constants.TEXT_POST:
      obj = TEXT_POST.toJSON(buf)
      break
    case constants.DELETE_POST:
      obj = DELETE_POST.toJSON(buf)
      break
    case constants.INFO_POST:
      obj = INFO_POST.toJSON(buf)
      break
    case constants.TOPIC_POST:
      obj = TOPIC_POST.toJSON(buf)
      break
    case constants.JOIN_POST:
      obj = JOIN_POST.toJSON(buf)
      break
    case constants.LEAVE_POST:
      obj = LEAVE_POST.toJSON(buf)
      break
    default:
      throw new Error(`parse post: unknown post type (${postType})`)
  }
  return obj
}

// a message is either a request or a response; not a post (for posts, see parsePost)
function parseMessage (buf) {
  const msgType = peek(buf)
  let obj
  switch (msgType) {
    case constants.HASH_RESPONSE:
      obj = HASH_RESPONSE.toJSON(buf)
      break
    case constants.DATA_RESPONSE:
      obj = DATA_RESPONSE.toJSON(buf)
      break
    case constants.HASH_REQUEST:
      obj = HASH_REQUEST.toJSON(buf)
      break
    case constants.CANCEL_REQUEST:
      obj = CANCEL_REQUEST.toJSON(buf)
      break
    case constants.TIME_RANGE_REQUEST:
      obj = TIME_RANGE_REQUEST.toJSON(buf)
      break
    case constants.CHANNEL_STATE_REQUEST:
      obj = CHANNEL_STATE_REQUEST.toJSON(buf)
      break
    case constants.CHANNEL_LIST_REQUEST:
      obj = CHANNEL_LIST_REQUEST.toJSON(buf)
      break
    case constants.CHANNEL_LIST_RESPONSE:
      obj = CHANNEL_LIST_RESPONSE.toJSON(buf)
      break
    default:
      throw new Error(`parse post: unknown post type (${postType})`)
  }
  return obj
}

function insertNewTTL(buf, expectedType) {
    let offset = 0
    // 1. msgLen
    decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    const msgLenOffset = offset
    // 2. msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== expectedType) {
      throw new Error(`decoded msgType is not of expected type (expected ${expectedType}, was ${msgType})`)
    }
    // 3. reqid
    offset += constants.REQID_SIZE
    // get ttl
    const beforeTTL = buf.subarray(msgLenOffset, offset)
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    const afterTTL = buf.subarray(offset)

    // decrement ttl
    const newTTL = ttl - 1
    if (newTTL < 0) { throw new Error("ttl negative") }

    const newBuf = b4a.concat([beforeTTL, encodeVarintBuffer(newTTL), afterTTL])
    return prependMsgLen(newBuf)
}

function prependMsgLen (buf) {
  const msglen = encodeVarintBuffer(buf.length)
  // prepend msglen before the contents and we're done
  return b4a.concat([msglen, buf])
}

// attempt to extract a varint from a buffer `frame`, starting at `offset`
function decodeVarintSlice (frame, offset) {
  let decodedSlice
  let sliceEnd 
  for (let i = 1; i < constants.MAX_VARINT_SIZE; i++) {
    sliceEnd = offset + i 
    const frameSlice = frame.subarray(offset, sliceEnd)
    try {
      decodedSlice = varint.decode(frameSlice)
      return decodedSlice
    } catch (e) {
      if (e instanceof RangeError) {
        continue
      }
      throw RangeError
    }
  }
  return decodedSlice
}

function isInteger(n) {
  return Number.isInteger(n)
}

function isBufferSize(b, SIZE) {
  if (b4a.isBuffer(b)) {
    return b.length === SIZE
  }
  return false
}

function isString (s) {
  return typeof s === "string"
}

function isArrayData (arr) {
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      if (!b4a.isBuffer(arr[i])) {
        return false
      }
    }
    return true
  }
  return false
}

function isArrayString (arr) {
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] !== "string") {
        return false
      }
    }
    return true
  }
  return false
}

function isArrayHashes (arr) {
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      if (!isBufferSize(arr[i], constants.HASH_SIZE)) {
        return false
      }
    }
    return true
  }
  return false
}

function encodeVarintBuffer (n) {
  // take integer, return varint encoded buffer representation
  return b4a.from(varint.encode(n))
}

function writeVarint (n, buf, offset) {
  // take integer, buffer to write to, and offset to write at
  // return amount of varint encoded bytes written
  const varintBuf = encodeVarintBuffer(n)
  varintBuf.copy(buf, offset)
  return varint.encode.bytes
}

module.exports = { 
  HASH_RESPONSE, 
  DATA_RESPONSE, 
  CHANNEL_LIST_RESPONSE,

  HASH_REQUEST, 
  CANCEL_REQUEST, 
  TIME_RANGE_REQUEST, 
  CHANNEL_STATE_REQUEST, 
  CHANNEL_LIST_REQUEST, 

  TEXT_POST,
  DELETE_POST,
  INFO_POST,
  TOPIC_POST,
  JOIN_POST,
  LEAVE_POST,

  peek,
  peekReqid,
  peekPost,
  parsePost,
  parseMessage
}
