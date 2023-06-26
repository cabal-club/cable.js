// SPDX-FileCopyrightText: 2023 the cabal-club authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

const b4a = require("b4a")
const sodium = require("sodium-universal")

// copy in utility functions into file to decrease audit burden / minimize # imported depdencies
function isBufferSize(b, SIZE) {
  if (b4a.isBuffer(b)) {
    return b.length === SIZE
  }
  return false
}

function bufferExpected (fn) {
  return new Error(`function ${fn} expected a buffer`)
}

function bufferExpectedSize (fn, variableName, size) {
  return new Error(`function ${fn} expected ${variableName} to be a buffer of size ${size}`)
}

function generateReqID() {
  // alloc buf with 4 bytes
  const buf = b4a.alloc(4)
  // fill buffer with cryptograhically random bytes
  sodium.randombytes_buf(buf)
  return buf
}

function generateKeypair() {
  const kp = { 
    publicKey: b4a.alloc(sodium.crypto_sign_PUBLICKEYBYTES).fill(0),
    secretKey: b4a.alloc(sodium.crypto_sign_SECRETKEYBYTES).fill(0)
  }

  sodium.crypto_sign_keypair(kp.publicKey, kp.secretKey)

  return kp
}

// buf is a buffer that is exactly as large as the message (i.e. no overshooting placeholder bytes after message
// payload)
function sign (buf, secretKey) {
  if (!b4a.isBuffer(buf)) {
    throw bufferExpected("sign")
  }
  if (!isBufferSize(secretKey, sodium.crypto_sign_SECRETKEYBYTES)) {
    throw bufferExpectedSize("sign", "secretKey", sodium.crypto_sign_SECRETKEYBYTES)
  }
  const sigAndPayload = buf.subarray(sodium.crypto_sign_PUBLICKEYBYTES)
  const payload = buf.subarray(sodium.crypto_sign_PUBLICKEYBYTES + sodium.crypto_sign_BYTES)
  sodium.crypto_sign(sigAndPayload, payload, secretKey)
}

// buf is a buffer that is exactly as large as the message (i.e. no overshooting placeholder bytes after message
// payload)
function verify (buf, publicKey) {
  if (!b4a.isBuffer(buf)) {
    throw bufferExpected("verify")
  }
  if (!isBufferSize(publicKey, sodium.crypto_sign_PUBLICKEYBYTES)) {
    throw bufferExpectedSize("verify", "publicKey", sodium.crypto_sign_PUBLICKEYBYTES)
  }
  const sigAndPayload = buf.subarray(sodium.crypto_sign_PUBLICKEYBYTES)
  const payload = buf.subarray(sodium.crypto_sign_PUBLICKEYBYTES + sodium.crypto_sign_BYTES)
  return sodium.crypto_sign_open(payload, sigAndPayload, publicKey)
}

function hash(buf) {
  const output = b4a.alloc(sodium.crypto_generichash_BYTES)
  sodium.crypto_generichash(output, buf)
  return output
}

module.exports = {
  generateReqID,
  generateKeypair,
  hash,
  sign,
  verify
}
