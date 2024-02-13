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

const EMPTY_CIRCUIT_ID = b4a.alloc(4, 0)

// TODO (2023-01-11): 
// would like to abstract away `offset += varint.decode.bytes` in case we swap library / opt for self-authored standard

// TODO (2023-04-18): introduce specific error classes to be able to distinguish between e.g. missing # of parameters (fatal impl error) and lengths of strings (user behaviour, recoverable)

const LINKS_EXPECTED = new Error("expected links to contain an array of hash-sized buffers")
const ARRAY_POSTS_EXPECTED = new Error("expected recipients to contain an array of hash-sized buffers")
const ARRAY_KEYS_EXPECTED = new Error("expected recipients to contain an array of publicKey-sized buffers")
const EMPTY_RECIPIENTS_EXPECTED = new Error("expected recipients to be length zero")
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
function emptyExpected (param) {
  return new Error(`expected ${param} to be the empty string`)
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

    const size = determineBufferSize([
      {v: constants.HASH_RESPONSE},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE}, 
      {h: hashes.length}
    ]) 

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.HASH_RESPONSE, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 4. write amount of hashes (hash_count)
    offset += writeVarint(hashes.length, frame, offset)
    // 5. write the hashes themselves
    hashes.forEach(hash => {
      offset += b4a.copy(hash, frame, offset)
    })
    return prependMsgLen(frame)
  }
  // takes a message buffer and returns the json object: 
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
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

    return { msgLen, msgType, reqid, hashes }
  }
}

class POST_RESPONSE {
  static create(reqid, posts) {
    if (arguments.length !== 2) { throw wrongNumberArguments(2, arguments.length, "create(reqid, posts)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isArrayData(posts)) { throw new Error(`expected posts to be a buffer`) }

    const size = determineBufferSize([
      {v: constants.POST_REQUEST},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE},
      {b: countPostsBytes(posts)},
      {v: 0} // concluding postLen = 0
    ])

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.POST_RESPONSE, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 4. exhaust array of posts
    for (let i = 0; i < posts.length; i++) {
      // 4.1 write postLen 
      offset += writeVarint(posts[i].length, frame, offset)
      // 4.2 then write the post itself
      offset += b4a.copy(posts[i], frame, offset)
    }
    // 4.3 finally: write postLen = 0 to signal end of data
    offset += writeVarint(0, frame, offset)
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
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.POST_RESPONSE) {
      throw new Error("decoded msgType is not of expected type (constants.POST_RESPONSE)")
    }
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
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
      posts.push(buf.slice(offset, offset + postLen))
      offset += postLen
      
      remaining = msgLen - offset + msgLenBytes
    }

    return { msgLen, msgType, reqid, posts }
  }
}


class POST_REQUEST {
  // constructs a message buffer using the incoming arguments
  static create(reqid, ttl, hashes) {
    if (arguments.length !== 3) { throw wrongNumberArguments(3, arguments.length, "create(reqid, ttl, hashes)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isArrayHashes(hashes)) { throw HASHES_EXPECTED }

    const size = determineBufferSize([
      {v: constants.POST_REQUEST},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE},
      {v: ttl},
      {h: hashes.length}
    ])

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.POST_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 4. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 5. write amount of hashes (hash_count varint)
    offset += writeVarint(hashes.length, frame, offset)
    // 6. write the hashes themselves
    hashes.forEach(hash => {
      offset += b4a.copy(hash, frame, offset)
    })
    return prependMsgLen(frame)
  }

  // takes a message buffer and returns the json object: 
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
    if (msgType !== constants.POST_REQUEST) {
      throw new Error("decoded msgType is not of expected type (constants.POST_REQUEST)")
    }
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    offset += constants.REQID_SIZE
    // 5. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get hashCount
    const hashCount = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. use hashCount to slice out the hashes
    let hashes = []
    for (let i = 0; i < hashCount; i++) {
      hashes.push(buf.slice(offset, offset + constants.HASH_SIZE))
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
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isBufferSize(cancelid, constants.REQID_SIZE)) { throw bufferExpected("cancelid", constants.REQID_SIZE) }

    const size = determineBufferSize([
      {v: constants.CANCEL_REQUEST},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE},
      {v: ttl},
      {b: constants.REQID_SIZE} // cancelid
    ])

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CANCEL_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 3. write ttl (unused)
    offset += writeVarint(ttl, frame, offset)
    // 4. write cancelid
    offset += b4a.copy(cancelid, frame, offset)

    return prependMsgLen(frame)
  }

  // takes a message buffer and returns the json object: 
  // { msgLen, msgType, reqid, cancelid }
  static toJSON(buf) {
    let offset = 0
    // 1. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CANCEL_REQUEST) {
      throw new Error("decoded msgType is not of expected type (constants.CANCEL_REQUEST)")
    }

    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    // 5. get ttl (unused for cancel request)
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get cancelid
    const cancelid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE

    return { msgLen, msgType, reqid, ttl, cancelid }
  }
}

class TIME_RANGE_REQUEST {
  static create(reqid, ttl, channel, timeStart, timeEnd, limit) {
    if (arguments.length !== 6) { throw wrongNumberArguments(6, arguments.length, "create(reqid, ttl, channel, timeStart, timeEnd, limit)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isInteger(ttl)) { throw integerExpected("ttl") }
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(timeStart)) { throw integerExpected("timeStart") }
    if (!isInteger(timeEnd)) { throw integerExpected("timeEnd") }
    if (!isInteger(limit)) { throw integerExpected("limit") }

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)

    const size = determineBufferSize([
      {v: constants.TIME_RANGE_REQUEST},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE},
      {v: ttl},
      {s: channelBuf.length},
      {v: timeStart},
      {v: timeEnd},
      {v: limit}
    ])

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.TIME_RANGE_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 4. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 5. write channel_len
    offset += writeVarint(channelBuf.length, frame, offset)
    // 6. write the channel
    offset += b4a.copy(channelBuf, frame, offset)
    // 7. write time_start
    offset += writeVarint(timeStart, frame, offset)
    // 8. write time_end
    offset += writeVarint(timeEnd, frame, offset)
    // 9. write limit
    offset += writeVarint(limit, frame, offset)
    return prependMsgLen(frame)
  }
  
  // takes a message buffer and returns the json object: 
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    // 5. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. use channelLen to slice out the channel
    const channelBuf = buf.slice(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = b4a.toString(channelBuf, "utf8")
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
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isInteger(future)) { throw integerExpected("future") }

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)

    const size = determineBufferSize([
      {v: constants.CHANNEL_STATE_REQUEST},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE},
      {v: ttl},
      {s: channelBuf.length},
      {v: future},
    ])

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CHANNEL_STATE_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 4. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 5. write channel_len
    offset += writeVarint(channelBuf.length, frame, offset)
    // 6. write the channel
    offset += b4a.copy(channelBuf, frame, offset)
    // 7. write future
    offset += writeVarint(future, frame, offset)
    return prependMsgLen(frame)
  }
  // takes a message buffer and returns the json object: 
  // { msgLen, msgType, reqid, ttl, channel, future }
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 5. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    // 6. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. use channelLen to slice out channel
    const channelBuf = buf.slice(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = b4a.toString(channelBuf, "utf8")
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
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
    if (!isInteger(argOffset)) { throw integerExpected("offset") }
    if (!isInteger(limit)) { throw integerExpected("limit") }

    const size = determineBufferSize([
      {v: constants.CHANNEL_LIST_REQUEST},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE},
      {v: ttl},
      {v: argOffset},
      {v: limit}
    ])

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CHANNEL_LIST_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 4. write ttl
    offset += writeVarint(ttl, frame, offset)
    // 5. write offset 
    offset += writeVarint(argOffset, frame, offset)
    // 6. write limit 
    offset += writeVarint(limit, frame, offset)

    return prependMsgLen(frame)
  }
  // takes a message buffer and returns the json object: 
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
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 5. get ttl
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (!ttlRangeCorrect(ttl)) { throw ttlRangeExpected(ttl) }
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

    const size = determineBufferSize([
      {v: constants.CHANNEL_LIST_RESPONSE},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE},
      {b: countChannelsBytes(channels)},
      {v: 0} // concluding channelLen = 0
    ])

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.CHANNEL_LIST_RESPONSE, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 4. write channels
    channels.forEach(channel => {
      // convert to buf: yields correct length wrt utf-8 bytes + used when copying
      const channelBuf = b4a.from(channel, "utf8")
      validation.checkChannelName(channelBuf)
      // 4.1 write channelLen
      offset += writeVarint(channelBuf.length, frame, offset)
      // 4.2 write channel
      offset += b4a.copy(channelBuf, frame, offset)
    })
    // 4.3 finally: write a channelLen = 0 to signal end of channel data
    offset += writeVarint(0, frame, offset)

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
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 2. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.CHANNEL_LIST_RESPONSE) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.CHANNEL_LIST_RESPONSE)`)
    }
    // 3. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 4. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
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
      const channelBuf = buf.slice(offset, offset + channelLen)
      offset += channelLen
      validation.checkChannelName(channelBuf)
      const channel = b4a.toString(channelBuf, "utf8")
      channels.push(channel)
      remaining = msgLen - offset + msgLenBytes
    }

    return { msgLen, msgType, reqid, channels }
  }
}

class MODERATION_STATE_REQUEST {
  static create(reqid, channels, future, oldest) {
    if (arguments.length !== 4) { throw wrongNumberArguments(4, arguments.length, "create(reqid, channels, future, oldest)") }
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    if (!isArrayString(channels)) { throw STRINGS_EXPECTED }
    if (!isInteger(future)) { throw integerExpected("future") }
    if (!isInteger(oldest)) { throw integerExpected("oldest") }

    const size = determineBufferSize([
      {v: constants.MODERATION_STATE_REQUEST},
      {b: constants.CIRCUITID_SIZE},
      {b: constants.REQID_SIZE},
      {b: countChannelsBytes(channels)},
      {v: 0}, // concluding channelLen = 0
      {v: future},
      {v: oldest}
    ])

    // allocate exactly-sized buffer
    const frame = b4a.alloc(size)
    let offset = 0
    // 1. write message type
    offset += writeVarint(constants.MODERATION_STATE_REQUEST, frame, offset)
    // 2. write circuitid (unused spec rev 2023-04)
    offset += b4a.copy(EMPTY_CIRCUIT_ID, frame, offset)
    // 3. write reqid
    offset += b4a.copy(reqid, frame, offset)
    // 4. write channels
    channels.forEach(channel => {
      // convert to buf: yields correct length wrt utf-8 bytes + used when copying
      const channelBuf = b4a.from(channel, "utf8")
      validation.checkChannelName(channelBuf)
      // 4.1 write channelLen
      offset += writeVarint(channelBuf.length, frame, offset)
      // 4.2 write channel
      offset += b4a.copy(channelBuf, frame, offset)
    })
    // 4.3 finally: write a channelLen = 0 to signal end of channel data
    offset += writeVarint(0, frame, offset)
    // 5. write future varint
    offset += writeVarint(future, frame, offset)
    // 6. write oldest varint
    offset += writeVarint(oldest, frame, offset)

    return prependMsgLen(frame)
  }

  // takes a message buffer and returns the json object: 
  // { msgLen, msgType, reqid, channels, future, oldest }
  static toJSON(buf) {
    let offset = 0
    let msgLenBytes 
    // 0. get msgLen
    const msgLen = decodeVarintSlice(buf, 0)
    offset += varint.decode.bytes
    msgLenBytes = varint.decode.bytes
    if (!isBufferSize(buf.slice(offset), msgLen)) { throw bufferExpected("remaining buf", msgLen) }
    // 1. get msgType
    const msgType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (msgType !== constants.MODERATION_STATE_REQUEST) {
      return new Error(`"decoded msgType (${msgType}) is not of expected type (constants.MODERATION_STATE_REQUEST)`)
    }
    // 2. skip circuit (unused spec rev 2023-04)
    offset += constants.CIRCUITID_SIZE
    // 3. get reqid
    const reqid = buf.slice(offset, offset+constants.REQID_SIZE)
    offset += constants.REQID_SIZE
    if (!isBufferSize(reqid, constants.REQID_SIZE)) { throw bufferExpected("reqid", constants.REQID_SIZE) }
    // 4. get channels
    const channels = []
    // msgLen tells us the number of bytes in the remaining message i.e. *excluding* msgLen, 
    // so we need to account for that by adding msgLenBytes
    let remaining = msgLen - offset + msgLenBytes
    while (remaining > 0) {
    // 4.1 get channel size
      const channelLen = decodeVarintSlice(buf, offset)
      offset += varint.decode.bytes
      // 4.3 if channelLen === 0 then we have no more channels in this response
      if (channelLen === 0) { break }
      // 4.2. use channelLen to slice out the channel
      const channelBuf = buf.slice(offset, offset + channelLen)
      offset += channelLen
      validation.checkChannelName(channelBuf)
      const channel = b4a.toString(channelBuf, "utf8")
      channels.push(channel)
      remaining = msgLen - offset + msgLenBytes
    }
    // 5. get future
    const future = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 6. get oldest
    const oldest = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { msgLen, msgType, reqid, channels, future, oldest }
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

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    const textBuf = b4a.from(text, "utf8")
    validation.checkPostText(textBuf)

    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.TEXT_POST},
      {v: timestamp},
      {s: channelBuf.length},
      {s: textBuf.length}
    ]) 
    
    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.TEXT_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 8. write the channel
    offset += b4a.copy(channelBuf, buf, offset)
    // 9. write textLen
    offset += writeVarint(textBuf.length, buf, offset)
    // 10. write the text
    offset += b4a.copy(textBuf, buf, offset)

    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, channel, timestamp, text }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
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
    const channelBuf = buf.slice(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = b4a.toString(channelBuf, "utf8")
    // 9. get textLen
    const textLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. use textLen to get text
    const textBuf = buf.slice(offset, offset + textLen)
    offset += textLen
    validation.checkPostText(textBuf)
    const text = b4a.toString(textBuf, "utf8")

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

    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.DELETE_POST},
      {v: timestamp},
      {h: hashes.length}
    ]) 
    
    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.DELETE_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write num_deletions, which represents how many hashes we are requesting peers to delete
    offset += writeVarint(hashes.length, buf, offset)
    // 8. write the hashes themselves
    hashes.forEach(hash => {
      offset += b4a.copy(hash, buf, offset)
    })
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, timestamp, hash }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
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
      hashes.push(buf.slice(offset, offset + constants.HASH_SIZE))
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

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const keyBuf = b4a.from(key, "utf8")
    validation.checkInfoKey(keyBuf)
    const valueBuf = b4a.from(value, "utf8")
    validation.checkInfoValue(valueBuf)
    if (key === "name") {
      validation.checkUsername(valueBuf)
    }

    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.INFO_POST},
      {v: timestamp},
      {s: keyBuf.length},
      {s: valueBuf.length},
      {v: 0} // concluding keyN_len = 0
    ]) 

    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.INFO_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // TODO (2023-07-12): this intentionally only handles the 1 value as spec only has 1 defined key (name). if we
    // change that, improve this routine to take multiple values into account
    // 7. write keyLen
    offset += writeVarint(keyBuf.length, buf, offset)
    // 8. write the key
    offset += b4a.copy(keyBuf, buf, offset)
    // 9. write valueLen
    offset += writeVarint(valueBuf.length, buf, offset)
    // 10. write the value
    offset += b4a.copy(valueBuf, buf, offset)
    // 11. finally: signal end of key-val list by writing keyN_len = 0
    offset += writeVarint(0, buf, offset)
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, timestamp, key, value }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
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
    const keyBuf = buf.slice(offset, offset + keyLen)
    offset += keyLen
    validation.checkInfoKey(keyBuf)
    const key = b4a.toString(keyBuf, "utf8")
    // 9. get valueLen
    const valueLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. use valueLen to get value
    const valueBuf = buf.slice(offset, offset + valueLen)
    offset += valueLen
    validation.checkInfoValue(valueBuf)
    if (key === "name") {
      validation.checkUsername(valueBuf)
    }
    const value = b4a.toString(valueBuf, "utf8")
    // TODO (2023-07-12): if spec's post/info is expanded with more than 1 key (name), improve this routine
    // 11. get terminating keyN_len (should be zero)
    const finalValueLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (finalValueLen !== 0) {
      return new Error(`"post/info: final keyN_len should be 0, was ${finalValueLen}`)
    }

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
    
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    const topicBuf = b4a.from(topic, "utf8")
    validation.checkTopic(topicBuf)

    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.TOPIC_POST},
      {v: timestamp},
      {s: channelBuf.length},
      {s: topicBuf.length}
    ]) 

    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.TOPIC_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 8. write the channel
    offset += b4a.copy(channelBuf, buf, offset)
    // 9. write topicLen
    offset += writeVarint(topicBuf.length, buf, offset)
    // 10. write the topic
    offset += b4a.copy(topicBuf, buf, offset)
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, channel, timestamp, topic }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
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
    const channelBuf = buf.slice(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = b4a.toString(channelBuf, "utf8")
    // 9. get topicLen
    const topicLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. use topicLen to get topic
    const topicBuf = buf.slice(offset, offset + topicLen)
    offset += topicLen
    validation.checkTopic(topicBuf)
    const topic = b4a.toString(topicBuf, "utf8")

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
    
    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    
    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.JOIN_POST},
      {v: timestamp},
      {s: channelBuf.length}
    ])

    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.JOIN_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 8. write the channel
    offset += b4a.copy(channelBuf, buf, offset)
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, channel, timestamp }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
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
    const channelBuf = buf.slice(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = b4a.toString(channelBuf, "utf8")

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

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    
    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.LEAVE_POST},
      {v: timestamp},
      {s: channelBuf.length}
    ]) 

    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.LEAVE_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 8. write the channel
    offset += b4a.copy(channelBuf, buf, offset)
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  static toJSON(buf) {
    // { publicKey, signature, links, postType, channel, timestamp }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
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
    const channelBuf = buf.slice(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = b4a.toString(channelBuf, "utf8")

    return { publicKey, signature, links, postType, channel, timestamp }
  }
}

class ROLE_POST {
  static create(publicKey, secretKey, links, channel, timestamp, recipient, role, reason, privacy) {
    if (arguments.length !== 9) { throw wrongNumberArguments(9, arguments.length, "create(publicKey, secretKey, links, channel, timestamp, recipient, role, reason, privacy)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isBufferSize(recipient, constants.PUBLICKEY_SIZE)) { throw bufferExpected("recipient", constants.PUBLICKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isInteger(role)) { throw integerExpected("role") }
    if (!isInteger(privacy)) { throw integerExpected("privacy") }
    if (!isString(channel)) { throw stringExpected("channel") }
    if (!isString(reason)) { throw stringExpected("reason") }

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    const reasonBuf = b4a.from(reason, "utf8")
    validation.checkReason(reasonBuf)
    
    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.ROLE_POST},
      {v: timestamp},
      {s: reasonBuf.length},
      {v: privacy},
      {s: channelBuf.length},
      {b: constants.PUBLICKEY_SIZE}, // recipient
      {v: role}
    ]) 

    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.ROLE_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write reasonLen
    offset += writeVarint(reasonBuf.length, buf, offset)
    // 8. write the reason
    offset += b4a.copy(reasonBuf, buf, offset)
    // 9. write privacy
    offset += writeVarint(privacy, buf, offset)
    // 10. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 11. write the channel
    offset += b4a.copy(channelBuf, buf, offset)
    // 12. write recipient key
    offset += b4a.copy(recipient, buf, offset)
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  static toJSON(buf) {
    // {publicKey, secretKey, links, timestamp, reason, privacy, channel, recipient, role }
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.ROLE_POST) {
      return new Error(`decoded postType (${postType}) is not of expected type (constants.ROLE_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get reasonLen
    const reasonLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use reasonLen to get reason
    const reasonBuf = buf.slice(offset, offset + reasonLen)
    offset += reasonLen
    validation.checkReason(reasonBuf)
    const reason = b4a.toString(reasonBuf, "utf8")
    // 9. get privacy varint
    const privacy = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 11. use channelLen to get channel
    const channelBuf = buf.slice(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = b4a.toString(channelBuf, "utf8")
    // 12. get recipient
    const recipient = buf.slice(offset, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE

    return { publicKey, secretKey, links, timestamp, reason, privacy, channel, recipient, role }
  }
}

class MODERATION_POST {
  static create(publicKey, secretKey, links, channel, timestamp, recipients, action, reason, privacy) {
    if (arguments.length !== 9) { throw wrongNumberArguments(9, arguments.length, "create(publicKey, secretKey, links, channels, timestamp, recipients, action, reason, privacy)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isInteger(action)) { throw integerExpected("action") }
    switch (action) {
      case constants.ACTION_HIDE_POST:
      case constants.ACTION_UNHIDE_POST:
      case constants.ACTION_DROP_POST:
      case constants.ACTION_UNDROP_POST:
        if (!isArrayHashes(recipients)) { throw ARRAY_POSTS_EXPECTED }
        if (!isString(channel)) { throw stringExpected("channel") }
        break
      case constants.ACTION_HIDE_USER:
      case constants.ACTION_UNHIDE_USER:
        if (!isArrayPublicKeys(recipients)) { throw ARRAY_KEYS_EXPECTED }
        if (!isString(channel)) { throw stringExpected("channel") }
        break
      case constants.ACTION_DROP_CHANNEL:
      case constants.ACTION_UNDROP_CHANNEL:
        if (recipients.length > 0) { throw EMPTY_RECIPIENTS_EXPECTED }
        break
    }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isString(reason)) { throw stringExpected("reason") }
    if (!isInteger(privacy)) { throw integerExpected("privacy") }

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const channelBuf = b4a.from(channel, "utf8")
    validation.checkChannelName(channelBuf)
    const reasonBuf = b4a.from(reason, "utf8")
    validation.checkReason(reasonBuf)

    validation.checkRecipientsLength(recipients)
    
    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.MODERATION_POST},
      {v: timestamp},
      {s: reasonBuf.length},
      {v: privacy},
      {s: channelBuf.length},
      {h: recipients.length}, // recipients; bit of a hack as public_key + hash size are same # bytes
      {v: action}
    ]) 

    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.ROLE_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write reasonLen
    offset += writeVarint(reasonBuf.length, buf, offset)
    // 8. write the reason
    offset += b4a.copy(reasonBuf, buf, offset)
    // 9. write privacy
    offset += writeVarint(privacy, buf, offset)
    // 10. write channelLen
    offset += writeVarint(channelBuf.length, buf, offset)
    // 11. write the channel
    offset += b4a.copy(channelBuf, buf, offset)
    // 12. write recipient_count, whose entries each represent either a hash or a public key (both represented by bufs)
    offset += writeVarint(recipients.length, buf, offset)
    // 13. write the recipients themselves
    recipients.forEach(recipient => {
      offset += b4a.copy(recipient, buf, offset)
    })
    // 14. write action
    offset += writeVarint(action, buf, offset)
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  static toJSON(buf) {
    // {publicKey, secretKey, links, channel, timestamp, recipients, action, reason, privacy}
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.ROLE_POST) {
      return new Error(`decoded postType (${postType}) is not of expected type (constants.ROLE_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get reasonLen
    const reasonLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use reasonLen to get reason
    const reasonBuf = buf.slice(offset, offset + reasonLen)
    offset += reasonLen
    validation.checkReason(reasonBuf)
    const reason = b4a.toString(reasonBuf, "utf8")
    // 9. get privacy varint
    const privacy = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. get channelLen
    const channelLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 11. use channelLen to get channel
    const channelBuf = buf.slice(offset, offset + channelLen)
    offset += channelLen
    validation.checkChannelName(channelBuf)
    const channel = b4a.toString(channelBuf, "utf8")
    // 12. get numLinks
    const recipientCount = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 13. use recipientCount to slice out the recipients
    let recipients = []
    for (let i = 0; i < recipientCount; i++) {
      recipients.push(buf.slice(offset, offset + constants.HASH_SIZE)) // hack: making use current spec and that publicKeys and hashes have same # bytes ':)
      offset += constants.HASH_SIZE
    }
    validation.checkRecipientsLength(recipients)

    // 14. get action varint
    const action = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    // confirm recipients contents
    switch (action) {
      case constants.ACTION_HIDE_POST:
      case constants.ACTION_UNHIDE_POST:
      case constants.ACTION_DROP_POST:
      case constants.ACTION_UNDROP_POST:
        if (!isArrayHashes(recipients)) { throw ARRAY_POSTS_EXPECTED }
        break
      case constants.ACTION_HIDE_USER:
      case constants.ACTION_UNHIDE_USER:
        if (!isArrayPublicKeys(recipients)) { throw ARRAY_KEYS_EXPECTED }
        break
      case constants.ACTION_DROP_CHANNEL:
      case constants.ACTION_UNDROP_CHANNEL:
        if (recipients.length > 0) { throw EMPTY_RECIPIENTS_EXPECTED }
        break
    }

    return { publicKey, secretKey, links, timestamp, reason, privacy, channel, recipients, action }
  }
}

class BLOCK_POST {
  static create(publicKey, secretKey, links, timestamp, recipients, drop, notify, reason, privacy) {
    if (arguments.length !== 9) { throw wrongNumberArguments(9, arguments.length, "create(publicKey, secretKey, links, timestamp, recipient, drop, notify, reason, privacy)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isArrayPublicKeys(recipients)) { throw ARRAY_KEYS_EXPECTED }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isInteger(notify)) { throw integerExpected("notify") }
    if (!isInteger(drop)) { throw integerExpected("drop") }
    if (!isInteger(privacy)) { throw integerExpected("privacy") }
    if (!isString(reason)) { throw stringExpected("reason") }

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const reasonBuf = b4a.from(reason, "utf8")
    validation.checkReason(reasonBuf)

    validation.checkRecipientsLength(recipients)
    
    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.BLOCK_POST},
      {v: timestamp},
      {s: reasonBuf.length},
      {v: privacy},
      {h: recipients.length}, // recipients; bit of a hack as public_key + hash size are same # bytes
      {v: drop},
      {v: notify}
    ]) 

    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.BLOCK_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write reasonLen
    offset += writeVarint(reasonBuf.length, buf, offset)
    // 8. write the reason
    offset += b4a.copy(reasonBuf, buf, offset)
    // 9. write privacy
    offset += writeVarint(privacy, buf, offset)
    // 10. write recipient_count, whose entries are represented by a public key
    offset += writeVarint(recipients.length, buf, offset)
    // 11. write the recipients themselves
    recipients.forEach(recipient => {
      offset += b4a.copy(recipient, buf, offset)
    })
    // 12. write drop
    offset += writeVarint(drop, buf, offset)
    // 13. write notify
    offset += writeVarint(notify, buf, offset)
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  /* 2024-02-13: CONTINUE CONVERTING FROM HERE */
  static toJSON(buf) {
    // {publicKey, secretKey, links, timestamp, recipient, drop, notify, reason, privacy}
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.BLOCK_POST) {
      return new Error(`decoded postType (${postType}) is not of expected type (constants.BLOCK_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get reasonLen
    const reasonLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use reasonLen to get reason
    const reasonBuf = buf.slice(offset, offset + reasonLen)
    offset += reasonLen
    validation.checkReason(reasonBuf)
    const reason = b4a.toString(reasonBuf, "utf8")
    // 9. get privacy varint
    const privacy = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. get recipient_count
    const recipientCount = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 11. use recipientCount to slice out the recipients
    let recipients = []
    for (let i = 0; i < recipientCount; i++) {
      recipients.push(buf.slice(offset, offset + constants.PUBLICKEY_SIZE))
      offset += constants.PUBLICKEY_SIZE
    }
    if (!isArrayPublicKeys(recipients)) { throw ARRAY_KEYS_EXPECTED }
    validation.checkRecipientsLength(recipients)
    // 12. get drop varint
    const drop = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 13. get notify varint
    const notify = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { publicKey, secretKey, links, timestamp, reason, privacy, recipients, drop, notify }
  }
}

class UNBLOCK_POST {
  static create(publicKey, secretKey, links, timestamp, recipients, undrop, reason, privacy) {
    if (arguments.length !== 9) { throw wrongNumberArguments(9, arguments.length, "create(publicKey, secretKey, links, timestamp, recipient, undrop, reason, privacy)") }
    if (!isBufferSize(publicKey, constants.PUBLICKEY_SIZE)) { throw bufferExpected("publicKey", constants.PUBLICKEY_SIZE) }
    if (!isBufferSize(secretKey, constants.SECRETKEY_SIZE)) { throw bufferExpected("secretKey", constants.SECRETKEY_SIZE) }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    if (!isArrayPublicKeys(recipients)) { throw ARRAY_KEYS_EXPECTED }
    if (!isInteger(timestamp)) { throw integerExpected("timestamp") }
    if (!isInteger(notify)) { throw integerExpected("notify") }
    if (!isInteger(undrop)) { throw integerExpected("undrop") }
    if (!isInteger(privacy)) { throw integerExpected("privacy") }
    if (!isString(reason)) { throw stringExpected("reason") }

    // convert to buf: yields correct length wrt utf-8 bytes + used when copying
    const reasonBuf = b4a.from(reason, "utf8")
    validation.checkReason(reasonBuf)

    validation.checkRecipientsLength(recipients)
    
    const size = determineBufferSize([
      {b: constants.PUBLICKEY_SIZE},
      {b: constants.SIGNATURE_SIZE},
      {h: links.length},
      {v: constants.UNBLOCK_POST},
      {v: timestamp},
      {s: reasonBuf.length},
      {v: privacy},
      {h: recipients.length}, // recipients; bit of a hack as public_key + hash size are same # bytes
      {v: undrop}
    ]) 

    let offset = 0
    const buf = b4a.alloc(size)
    // 1. write public key
    offset += b4a.copy(publicKey, buf, 0)
    // 2. make space for signature, which is done last of all.
    offset += constants.SIGNATURE_SIZE
    // 3. write num_links, whose entries each represents a hash i.e. a buffer
    offset += writeVarint(links.length, buf, offset)
    // 4. write the links themselves
    links.forEach(link => {
      offset += b4a.copy(link, buf, offset)
    })
    // 5. write postType
    offset += writeVarint(constants.UNBLOCK_POST, buf, offset)
    // 6. write timestamp
    offset += writeVarint(timestamp, buf, offset)
    // 7. write reasonLen
    offset += writeVarint(reasonBuf.length, buf, offset)
    // 8. write the reason
    offset += b4a.copy(reasonBuf, buf, offset)
    // 9. write privacy
    offset += writeVarint(privacy, buf, offset)
    // 10. write recipient_count, whose entries are represented by a public key
    offset += writeVarint(recipients.length, buf, offset)
    // 11. write the recipients themselves
    recipients.forEach(recipient => {
      offset += b4a.copy(recipient, buf, offset)
    })
    // 12. write undrop
    offset += writeVarint(undrop, buf, offset)
    
    // now, time to make a signature
    crypto.sign(buf, secretKey)
    validation.checkSignature(buf, publicKey)

    return buf
  }

  /* 2024-02-13: CONTINUE CONVERTING FROM HERE */
  static toJSON(buf) {
    // {publicKey, secretKey, links, timestamp, recipient, undrop, notify, reason, privacy}
    let offset = 0
    // 1. get publicKey
    const publicKey = buf.slice(0, constants.PUBLICKEY_SIZE)
    offset += constants.PUBLICKEY_SIZE
    // 2. get signature
    const signature = buf.slice(offset, offset + constants.SIGNATURE_SIZE)
    offset += constants.SIGNATURE_SIZE
    // verify signature is correct
    validation.checkSignature(buf, publicKey)
    // 3. get numLinks
    const numLinks = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 4. use numLinks to slice out the links
    let links = []
    for (let i = 0; i < numLinks; i++) {
      links.push(buf.slice(offset, offset + constants.HASH_SIZE))
      offset += constants.HASH_SIZE
    }
    if (!isArrayHashes(links)) { throw LINKS_EXPECTED }
    // 5. get postType
    const postType = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    if (postType !== constants.UNBLOCK_POST) {
      return new Error(`decoded postType (${postType}) is not of expected type (constants.UNBLOCK_POST)`)
    }
    // 6. get timestamp
    const timestamp = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 7. get reasonLen
    const reasonLen = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 8. use reasonLen to get reason
    const reasonBuf = buf.slice(offset, offset + reasonLen)
    offset += reasonLen
    validation.checkReason(reasonBuf)
    const reason = b4a.toString(reasonBuf, "utf8")
    // 9. get privacy varint
    const privacy = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 10. get recipient_count
    const recipientCount = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    // 11. use recipientCount to slice out the recipients
    let recipients = []
    for (let i = 0; i < recipientCount; i++) {
      recipients.push(buf.slice(offset, offset + constants.PUBLICKEY_SIZE))
      offset += constants.PUBLICKEY_SIZE
    }
    if (!isArrayPublicKeys(recipients)) { throw ARRAY_KEYS_EXPECTED }
    validation.checkRecipientsLength(recipients)
    // 12. get undrop varint
    const undrop = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes

    return { publicKey, secretKey, links, timestamp, reason, privacy, recipients, undrop }
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
  return buf.slice(offset, offset+constants.REQID_SIZE)
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
    const beforeTTL = buf.slice(msgLenOffset, offset)
    const ttl = decodeVarintSlice(buf, offset)
    offset += varint.decode.bytes
    const afterTTL = buf.slice(offset)

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

function ttlRangeCorrect(ttl) {
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

function isArrayPublicKeys (arr) {
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      if (!isBufferSize(arr[i], constants.PUBLICKEY_SIZE)) {
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
  // varintBuf.copy(buf, offset)
  b4a.copy(varintBuf, buf, offset)
  return varint.encode.bytes
}

// determineBufferSize takes a list of objects, shorthand documented below, and uses them to determine and return correct length
// in bytes for when allocating a buffer for the inputs 

// SHORTHAND:
// v: integer which will be encoded as a varint
// b: number of bytes
// s: string input.
//    rep.s contains the length of the corresponding string buffer 
//    e.g. rep.s === channelBuf.length
// h: represents an array of HASH_SIZE sized hashes. 
//    rep.h is the number of such entries in the actual array
//    e.g. rep.h === hashes.length
function determineBufferSize(inputs) {
  let size = 0
  // rep, short for 'representation'
  inputs.forEach(rep => {
    if (rep.hasOwnProperty("b")) {
      size += rep.b
    } else if (rep.hasOwnProperty("v")) {
      size += varint.encode(rep.v).length
    } else if (rep.hasOwnProperty("h")) {
      size += rep.h * constants.HASH_SIZE + varint.encode(rep.h).length
    } else if (rep.hasOwnProperty("s")) {
      size += rep.s + varint.encode(rep.s).length
    }
  })
  return size
}

function countPostsBytes (posts) {
  return posts.reduce((acc, p) => {
    acc += p.length + varint.encode(p.length).length /* varint.encode term accounts for the postLen varint */
    return acc
  }, 0) // init to 0
}

function countChannelsBytes(channels) {
  return channels.reduce((acc, c) => {
    const len = b4a.from(c, "utf8").length
    acc += len + varint.encode(len).length /* varint.encode term accounts for the channelLen varint */
    return acc
  }, 0) // init to 0
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
