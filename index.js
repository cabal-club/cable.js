// SPDX-FileCopyrightText: 2023 the cabal-club authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

// all uses of "buffer" refer to the structure represented by b4a: 
// i.e. a nodejs buffer if running nodejs, or a Uint8Array in the web
const b4a = require("b4a")
const constants = require("./constants.js")
const varint = require("varint")
const crypto = require("./cryptography.js")
const validation = require("./validation.js")

// TODO (2023-01-10):
// in the create methods: improve resiliency by detecting when the pre-allocated buffer will not be large enough, and reallocate a larger buffer

// TODO (2023-01-11): regarding byte size of a string
// is it enough to simply do str.length to get the correct byte size? any gotchas?

// TODO (2023-01-11): 
// would like to abstract away `offset += varint.decode.bytes` in case we swap library / opt for self-authored standard

// TODO (2023-04-18): introduce specific error classes to be able to distinguish between e.g. missing # of parameters (fatal impl error) and lengths of strings (user behaviour, recoverable)
const LINKS_EXPECTED = new Error("expected links to contain an array of hash-sized buffers")
const HASHES_EXPECTED = new Error("expected hashes to contain an array of hash-sized buffers")
const STRINGS_EXPECTED = new Error("expected channels to contain an array of strings")
function bufferExpected (param, size) {
  return new Error(`expected ${param} to be a buffer of size ${size}`)
}
function bufferExpectedMax (param, max, actual) {
  return new Error(`expected ${param} to be a buffer of at most ${max} bytes; was ${actual}`)
}
function integerExpected (param) {
  return new Error(`expected ${param} to be an integer`)
}
function stringExpected (param) {
  return new Error(`expected ${param} to be a string`)
}
function ttlRangeExpected (param) {
  return new Error(`expected ttl to be between 0 and 16, was ${param}`)
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
    // 2. write circuitid (unused spec rev 2023-04)
    offset += EMPTY_CIRCUIT_ID.copy(frame, offset)
    // 3. write reqid
    offset += reqid.copy(frame, offset)
    // 4. write amount of hashes (hash_count)
    offset += writeVarint(hashes.length, frame, offset)
    // 5. write the hashes themselves
    hashes.forEach(hash => {
      offset += hash.copy(frame, offset)
    })
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a message buffer and returns the json object: 
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
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

    return { msgLen, msgType, reqid, hashes }
  }
}

class POST_RESPONSE {
  static create(reqid, posts) {
    if (arguments.length !== 2) { throw wrongNumberArguments(2, arguments.length, "create(reqid, posts)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isArrayData(posts)) { throw new Error(`expected posts to be a buffer`) }
    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.POST_RESPONSE, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += EMPTY_CIRCUIT_ID.copy(frame, offset)
    // 3. write reqid
    offset += reqid.copy(frame, offset)
    // 4. exhaust array of posts
    for (let i = 0; i < posts.length; i++) {
      // 4.1 write postLen 
      offset += writeVarint(posts[i].length, frame, offset)
      // 4.2 then write the post itself
      offset += posts[i].copy(frame, offset)
    }
    // 4.3 finally: write postLen = 0 to signal end of data
    offset += writeVarint(0, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a message buffer and returns the json object: 
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
    if (msgType !== constants.POST_RESPONSE) {
      throw new Error("decoded msgType is not of expected type (constants.POST_RESPONSE)")
    }
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
    // 5. remaining buffer consists of [postLen, post] segments
    // read until it runs out
    let posts = []
    // msgLen tells us the number of bytes in the remaining message i.e. *excluding* msgLen, 
    // so we need to account for that by adding msgLenBytes
    let remaining = msgLen - offset + msgLenBytes
    while (remaining > 0) {
      const postLen = decodeVarintSlice(buf, offset)
      offset += varint.decode.bytes
      // if postLen === 0 then we have no more posts
      if (postLen === 0) { break }
      // 6. use postLen to slice out the hashes
      posts.push(buf.subarray(offset, offset + postLen))
      offset += postLen
      
      remaining = msgLen - offset + msgLenBytes
    }

    return { msgLen, msgType, reqid, posts }
  }
}

const EMPTY_CIRCUIT_ID = b4a.alloc(4).fill(0)

class POST_REQUEST {
  // constructs a message buffer using the incoming arguments
  static create(reqid, ttl, hashes) {
    if (arguments.length !== 3) { throw wrongNumberArguments(3, arguments.length, "create(reqid, ttl, hashes)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.POST_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += EMPTY_CIRCUIT_ID.copy(frame, offset)
    // 3. write reqid
    offset += reqid.copy(frame, offset)
    // 4. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 5. write amount of hashes (hash_count varint)
    offset += writeVarint(hashes.length, frame, offset)
    // 6. write the hashes themselves
    hashes.forEach(hash => {
      offset += hash.copy(frame, offset)
    })
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }

  // takes a message buffer and returns the json object: 
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
    if (msgType !== constants.POST_REQUEST) {
      throw new Error("decoded msgType is not of expected type (constants.POST_REQUEST)")
    }
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
    // 5. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get hashCount
    const hashCount = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. use hashCount to slice out the hashes
    let hashes = []
    for (let i = 0; i < hashCount; i++) {
      hashes.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    return { msgLen, msgType, reqid, ttl, hashes }
  }

  static decrementTTL(buf) {
    return insertNewTTL(buf, constants.POST_REQUEST)
  }
}

class CANCEL_REQUEST {
  // constructs a message buffer using the incoming arguments
  static create(reqid, ttl, cancelid) {
    if (arguments.length !== 3) { throw wrongNumberArguments(3, arguments.length, "create(reqid, ttl, cancelid)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isBufferSize(cancelid, constants.REQID_SIZE)) { throw bufferExpected("cancelid", constants.REQID_SIZE) }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CANCEL_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += EMPTY_CIRCUIT_ID.copy(frame, offset)
    // 3. write reqid
    offset += reqid.copy(frame, offset)
    // 3. write ttl (unused)
    offset += writeVarint(ttl, frame, offset)
    // 4. write cancelid
    offset += cancelid.copy(frame, offset)

    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }

  // takes a message buffer and returns the json object: 
  // { msgLen, msgType, reqid, cancelid }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.subarray(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CANCEL_REQUEST) {
      throw new Error("decoded msgType is not of expected type (constants.CANCEL_REQUEST)")
    }

    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    // 5. get ttl (unused for cancel request)
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get cancelid
    const cancelid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE

    return { msgLen, msgType, reqid, ttl, cancelid }
  }
}

class TIME_RANGE_REQUEST {
  static create(reqid, ttl, channel, timeStart, timeEnd, limit) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(reqid, ttl, channel, timeStart, timeEnd, limit)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timeStart)) { throw integerExpected("timeStart") }
    if (!isInteger(timeEnd)) { throw integerExpected("timeEnd") }
    if (!isInteger(limit)) { throw integerExpected("limit") }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.TIME_RANGE_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += EMPTY_CIRCUIT_ID.copy(frame, offset)
    // 3. write reqid
    offset += reqid.copy(frame, offset)
    // 4. write ttl
    offset += writeVarint(ttl, frame, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    // 5. write channel_len
    offset += writeVarint(channelBuf.length, frame, offset)
    // 6. write the channel
    offset += channelBuf.copy(frame, offset)
    // 7. write time_start
    offset += writeVarint(timeStart, frame, offset)
    // 8. write time_end
    offset += writeVarint(timeEnd, frame, offset)
    // 9. write limit
    offset += writeVarint(limit, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  
  // takes a message buffer and returns the json object: 
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    // 5. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. use channelLen to slice out the channel
    const channelBuf = buf.subarray(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = channelBuf.toString("utf8")
    // 8. get timeStart
    const timeStart = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 9. get timeEnd
    const timeEnd = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. get limit
    const limit = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { msgLen, msgType, reqid, ttl, channel, timeStart, timeEnd, limit }
  }

  static decrementTTL(buf) {
    return insertNewTTL(buf, constants.TIME_RANGE_REQUEST)
  }
}

class CHANNEL_STATE_REQUEST {
  static create(reqid, ttl, channel, future) {
    if (arguments.length !== 4) { throw wrongNumberArguments(4, arguments.length, "create(reqid, ttl, channel, future)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(future)) { throw integerExpected("future") }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CHANNEL_STATE_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += EMPTY_CIRCUIT_ID.copy(frame, offset)
    // 3. write reqid
    offset += reqid.copy(frame, offset)
    // 4. write ttl
    offset += writeVarint(ttl, frame, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    // 5. write channel_len
    offset += writeVarint(channelBuf.length, frame, offset)
    // 6. write the channel
    offset += channelBuf.copy(frame, offset)
    // 7. write future
    offset += writeVarint(future, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a message buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, channel, future }
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 5. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. use channelLen to slice out channel
    const channelBuf = buf.subarray(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = channelBuf.toString("utf8")
    // 8. get future
    const future = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { msgLen, msgType, reqid, ttl, channel, future }
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
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isInteger(argOffset)) { throw integerExpected("offset") }
    if (!isInteger(limit)) { throw integerExpected("limit") }

    // allocate default-sized buffer
    let frame = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CHANNEL_LIST_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += EMPTY_CIRCUIT_ID.copy(frame, offset)
    // 3. write reqid
    offset += reqid.copy(frame, offset)
    // 4. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 5. write offset 
    offset += writeVarint(argOffset, frame, offset)
    // 6. write limit 
    offset += writeVarint(limit, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a message buffer and returns the json object: 
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 5. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangecorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get offset
    const argOffset = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get limit
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
    // 2. write circuitid (unused spec rev 2023-04)
    offset += EMPTY_CIRCUIT_ID.copy(frame, offset)
    // 3. write reqid
    offset += reqid.copy(frame, offset)
    // 4. write channels
    channels.forEach(channel => {
      // convert to buf: yields correct length wrt utf-8 bytes + used when copying
      const channelBuf = b4a.from(channel, "utf8")
      validation.checkChannelName(channelBuf)
      // 4.1 write channelLen
      offset += writeVarint(channelBuf.length, frame, offset)
      // 4.2 write channel
      offset += channelBuf.copy(frame, offset)
    })
    // 4.3 finally: write a channelLen = 0 to signal end of channel data
    offset += writeVarint(0, frame, offset)
    // resize buffer, since we have written everything except msglen
    frame = frame.subarray(0, offset)
    return prependMsgLen(frame)
  }
  // takes a message buffer and returns the json object: 
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.subarray(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 5. get channels
    const channels = []
    // msgLen tells us the number of bytes in the remaining message i.e. *excluding* msgLen, 
    // so we need to account for that by adding msgLenBytes
    let remaining = msgLen - offset + msgLenBytes
    while (remaining > 0) {
    // get channel size
      const channelLen = decodeVarintSlice(buf, offset)
      offset += varint.decode.bytes
      // if channelLen === 0 then we have no more channels in this response
      if (channelLen === 0) { break }
      // 6. use channelLen to slice out the channel
      const channelBuf = buf.subarray(offset, offset + channelLen)
      offset += channelLen
      validation.checkChannelName(channelBuf)
      const channel = channelBuf.toString("utf8")
      channels.push(channel)
      remaining = msgLen - offset + msgLenBytes
    }

    return { msgLen, msgType, reqid, channels }
  }
}

class TEXT_POST {
  static create(publicKey, secretKey, links, channel, timestamp, text) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(publicKey, secretKey, links, channel, timestamp, text)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isString(text)) { throw stringExpected("text") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += link.copy(buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.TEXT_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    // 7. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 8. write the channel
    offset += channelBuf.copy(buf, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const textBuf = b4a.from(text, "utf8")
    validation.checkPostText(textBuf)
    // 9. write textLen
    offset += writeVarint(textBuf.length, buf, offset)
    // 10. write the text
    offset += textBuf.copy(buf, offset)

    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    validation.checkSignature(message, publicKey)

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, channel, timestamp, text }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }

    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.TEXT_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.TEXT_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use channelLen to get channel
    const channelBuf = buf.subarray(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = channelBuf.toString("utf8")
    // 9. get textLen
    const textLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. use textLen to get text
    const textBuf = buf.subarray(offset, offset + textLen)
    offset += textLen
    validation.checkPostText(textBuf)
    const text = textBuf.toString("utf8")

    return { publicKey, signature, links, postType, channel, timestamp, text }
  }
}

class DELETE_POST {
  static create(publicKey, secretKey, links, timestamp, hashes) {
    if (arguments.length !== 5) { throw wrongNumberArguments(5, arguments.length, "create(publicKey, secretKey, links, timestamp, hash)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += link.copy(buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.DELETE_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write num_deletions, which represents how many hashes we are requesting peers to delete
    offset += writeVarint(hashes.length, buf, offset)
    // 8. write the hashes themselves
    hashes.forEach(hash => {
      offset += hash.copy(buf, offset)
    })
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    validation.checkSignature(message, publicKey)

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, timestamp, hash }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.DELETE_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.DELETE_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get num_deletions
    const numDeletions = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    let hashes = []
    // 8. get the hashes
    for (let i = 0; i < numDeletions; i++) {
      hashes.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    return { publicKey, signature, links, postType, timestamp, hashes }
  }
}
  
// TODO (2023-04-20): take a list of [key, value] instead of a single pair
class INFO_POST {
  static create(publicKey, secretKey, links, timestamp, key, value) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(publicKey, secretKey, links, timestamp, key, value)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isString(key)) { throw stringExpected("key") }
    if (!isString(value)) { throw stringExpected("value") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += link.copy(buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.INFO_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const keyBuf = b4a.from(key, "utf8")
    validation.checkInfoKey(keyBuf)
    // 7. write keyLen
    offset += writeVarint(keyBuf.length, buf, offset)
    // 8. write the key
    offset += keyBuf.copy(buf, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const valueBuf = b4a.from(value, "utf8")
    validation.checkInfoValue(valueBuf)
    if (key === "name") {
      validation.checkUsername(valueBuf)
    }
    // 9. write valueLen
    offset += writeVarint(valueBuf.length, buf, offset)
    // 10. write the value
    offset += valueBuf.copy(buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    validation.checkSignature(message, publicKey)

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, timestamp, key, value }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.INFO_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.INFO_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get keyLen
    const keyLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use keyLen to get key
    const keyBuf = buf.subarray(offset, offset + keyLen)
    offset += keyLen
    validation.checkInfoKey(keyBuf)
    const key = keyBuf.toString("utf8")
    // 9. get valueLen
    const valueLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. use valueLen to get value
    const valueBuf = buf.subarray(offset, offset + valueLen)
    offset += valueLen
    validation.checkInfoValue(valueBuf)
    if (key === "name") {
      validation.checkUsername(valueBuf)
    }
    const value = valueBuf.toString("utf8")

    return { publicKey, signature, links, postType, timestamp, key, value }
  }
}

class TOPIC_POST {
  static create(publicKey, secretKey, links, channel, timestamp, topic) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(publicKey, secretKey, links, channel, timestamp, topic)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isString(topic)) { throw stringExpected("topic") }

    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += link.copy(buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.TOPIC_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    // 7. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 8. write the channel
    offset += channelBuf.copy(buf, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const topicBuf = b4a.from(topic, "utf8")
    validation.checkTopic(topicBuf)
    // 9. write topicLen
    offset += writeVarint(topicBuf.length, buf, offset)
    // 10. write the topic
    offset += topicBuf.copy(buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    validation.checkSignature(message, publicKey)

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, channel, timestamp, topic }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.TOPIC_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.TOPIC_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use channelLen to get channel
    const channelBuf = buf.subarray(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = channelBuf.toString("utf8")
    // 9. get topicLen
    const topicLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. use topicLen to get topic
    const topicBuf = buf.subarray(offset, offset + topicLen)
    offset += topicLen
    validation.checkTopic(topicBuf)
    const topic = topicBuf.toString("utf8")

    return { publicKey, signature, links, postType, channel, timestamp, topic }
  }
}

class JOIN_POST {
  static create(publicKey, secretKey, links, channel, timestamp) {
    if (arguments.length !== 5) { throw wrongNumberArguments(5, arguments.length, "create(publicKey, secretKey, links, channel, timestamp)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += link.copy(buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.JOIN_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    // 7. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 8. write the channel
    offset += channelBuf.copy(buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    validation.checkSignature(message, publicKey)

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, channel, timestamp }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.JOIN_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.JOIN_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use channelLen to get channel
    const channelBuf = buf.subarray(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = channelBuf.toString("utf8")

    return { publicKey, signature, links, postType, channel, timestamp }
  }
}

class LEAVE_POST {
  static create(publicKey, secretKey, links, channel, timestamp) {
    if (arguments.length !== 5) { throw wrongNumberArguments(5, arguments.length, "create(publicKey, secretKey, links, channel, timestamp)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    
    let offset = 0
    const buf = b4a.alloc(constants.DEFAULT_BUFFER_SIZE)
    // 1. write public key
    offset += publicKey.copy(buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += link.copy(buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.LEAVE_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    // 7. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 8. write the channel
    offset += channelBuf.copy(buf, offset)
    
    // everything has now been written, slice out the final message from the larger buffer
    const message = buf.subarray(0, offset)
    // now, time to make a signature
    crypto.sign(message, secretKey)
    validation.checkSignature(message, publicKey)

    return message
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, channel, timestamp }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.subarray(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.subarray(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.subarray(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.LEAVE_POST) {
      return new Error(`"decoded postType (${postType}) is not of expected type (constants.LEAVE_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use channelLen to get channel
    const channelBuf = buf.subarray(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = channelBuf.toString("utf8")

    return { publicKey, signature, links, postType, channel, timestamp }
  }
}


// peek returns the buf type of a message
function peekMessage (buf) {
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
  // skip circuitid
  offset += constants.CIRCUITID_SIZE
  // read & return reqid
  return buf.subarray(offset, offset+constants.REQID_SIZE)
}

// peek a buffer containing a cable post and return its post type
function peekPost (buf) {
  // skip public key + signature
  let offset = constants.PUBLICKEY_SIZE + constants.SIGNATURE_SIZE
  // read numLinks
  const numLinks = decodeVarintSlice(buf, offset)
  offset += varint.decode.bytes
  // skip reading links
  offset += numLinks * constants.HASH_SIZE
  // finally: read & return the post type
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
  const msgType = peekMessage(buf)
  let obj
  switch (msgType) {
    case constants.HASH_RESPONSE:
      obj = HASH_RESPONSE.toJSON(buf)
      break
    case constants.POST_RESPONSE:
      obj = POST_RESPONSE.toJSON(buf)
      break
    case constants.POST_REQUEST:
      obj = POST_REQUEST.toJSON(buf)
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
    // 3. circuitid
    offset += constants.CIRCUITID_SIZE
    // 4. reqid
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

function ttlRangecorrect(ttl) {
  return ttl >= 0 && ttl <= 16
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
  POST_RESPONSE, 
  CHANNEL_LIST_RESPONSE,

  POST_REQUEST, 
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

  peekMessage,
  peekReqid,
  peekPost,
  parsePost,
  parseMessage
}
