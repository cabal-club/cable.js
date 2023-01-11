// all uses of "buffer" refer to the structure represented by b4a: 
// i.e. a nodejs buffer if running nodejs, or a Uint8Array in the web
const b4a = require("b4a")
const constants = require("./constants.js")
const varint = require("varint")

// TODO (2023-01-10):
// * in the create methods: improve their resiliency by detecting when the pre-allocated buffer will not be large enough, and reallocatIe a larger buffer
// * reserve 4 bytes between `req_id` and `ttl`
//  in requests, and also in responses after `req_id` for circuits
// * in create methods: guard against invalid values for arguments 

// TODO (2023-01-11): validity checking of arguments 
// * reqid is a buffer of length REQID_SIZE
// * numbers: ttl, limit, updates, timeStart, timeEnd
// * hashes is a list of HASH_SIZE buffers
// * strings: channel, topic, text

const HASHES_EXPECTED = new Error("expected hashes to contain an array of hash-sized buffers")
function bufferExpected (param, size) {
  return new Error(`expected ${param} to be a buffer of size ${size}`)
}
function integerExpected (param) {
  return new Error(`expected ${param} to be an integer`)
}
function stringExpected (param) {
  return new Error(`expected ${param} to be a string`)
}

class HASH_RESPONSE {
  static create(reqid, hashes) {
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
    frame = frame.slice(0, offset)
    return prependMsgLen(frame)
  }
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, hashes }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.HASH_RESPONSE) {
      throw new Error("decoded msgType is not of expected type (constants.HASH_RESPONSE)")
    }
    // 3. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
    // 4. get hashCount
    const hashCount = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. use hashCount to slice out the hashes
    let hashes = []
    for (let i = 0; i < hashCount; i++) {
      hashes.push(buf.slice(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    return { msgLen, msgType, reqid, hashes }
  }
}

// class DATA_RESPONSE {
//   static create(reqid, datalist) {
//     console.log("reqid", reqid)
//     console.log("data", datalist)
//   }
//   static toJSON(buf) {
//     console.log("mah buf which i am to JSON forth")
//   }
// }

class HASH_REQUEST {
  // constructs a cablegram buffer using the incoming arguments
  static create(reqid, ttl, hashes) {
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
    frame = frame.slice(0, offset)
    return prependMsgLen(frame)
  }

  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, hashes }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.HASH_REQUEST) {
      throw new Error("decoded msgType is not of expected type (constants.HASH_REQUEST)")
    }
    // 3. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
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
      hashes.push(buf.slice(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    return { msgLen, msgType, reqid, ttl, hashes }
  }
}

class CANCEL_REQUEST {
  // constructs a cablegram buffer using the incoming arguments
  static create(reqid) {
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CANCEL_REQUEST, frame, offset)
    // 2. write reqid
    offset += reqid.copy(frame, varint.encode.bytes)

    // resize buffer, since we have written everything except msglen
    frame = frame.slice(0, offset)
    return prependMsgLen(frame)
  }

  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid }
  static toJSON(buf) {
    let offset = 0
    // 1. get mshLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CANCEL_REQUEST) {
      throw new Error("decoded msgType is not of expected type (constants.CANCEL_REQUEST)")
    }
    // 3. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE

    return { msgLen, msgType, reqid }
  }
}

class TIME_RANGE_REQUEST {
  static create(reqid, ttl, channel, timeStart, timeEnd, limit) {
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
    frame = frame.slice(0, offset)
    return prependMsgLen(frame)
  }
  
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, channel, timeStart, timeEnd, limit }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.TIME_RANGE_REQUEST) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.TIME_RANGE_REQUEST)`)
    }
    // 3. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    // 4. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. get channelSize
    const channelSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use channelSize to slice out the channel
    const channel = buf.slice(offset, offset + channelSize).toString()
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
}

class CHANNEL_STATE_REQUEST {
  static create(reqid, ttl, channel, limit, updates) {
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
    frame = frame.slice(0, offset)
    return prependMsgLen(frame)
  }
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, channel, limit, updates }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CHANNEL_STATE_REQUEST) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.CHANNEL_STATE_REQUEST)`)
    }
    // 3. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 4. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. get channelSize
    const channelSize = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. use channelSize to slice out channel
    const channel = buf.slice(offset, offset + channelSize).toString()
    offset += channelSize
    // 7. get limit
    const limit = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. get updates
    const updates = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { msgLen, msgType, reqid, ttl, channel, limit, updates }
  }
}

class CHANNEL_LIST_REQUEST {
  static create(reqid, ttl, limit) {
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
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
    // 4. write limit 
    offset += writeVarint(limit, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.slice(0, offset)
    return prependMsgLen(frame)
  }
  // takes a cablegram buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, limit }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CHANNEL_LIST_REQUEST) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.CHANNEL_LIST_REQUEST)`)
    }
    // 3. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 4. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 5. get limit
    const limit = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { msgLen, msgType, reqid, ttl, limit }
  }
}

// class TEXT_POST {
//   static create(pubkey, link, channel, timestamp, text)
//   static toJSON(buf)
// }
//

// peek returns the message type of a cablegram
function peek (buf) {
  // decode msg len, and discard
  decodeVarintSlice(buf, 0)
  const offset = varint.decode.bytes
  // decode and return msg type
  return decodeVarintSlice(buf, offset)
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
    const frameSlice = frame.slice(offset, sliceEnd)
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

function isArrayHashes (arr) {
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      if (!isBufferSize(arr[i], constants.HASH_SIZE)) {
        return false
      }
      return true
    }
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
  HASH_REQUEST, 
  CANCEL_REQUEST, 
  TIME_RANGE_REQUEST, 
  CHANNEL_STATE_REQUEST, 
  CHANNEL_LIST_REQUEST, 
  peek 
}
