const b4a = require("b4a")
const sodium = require("sodium-universal")

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

// buf is a buffer that is exactly as large as the message (i.e. no overshooting placegholder bytes after message
// payload)
function sign (buf, secretKey) {
  const sigAndPayload = buf.subarray(sodium.crypto_sign_PUBLICKEYBYTES)
  const payload = buf.subarray(sodium.crypto_sign_PUBLICKEYBYTES + sodium.crypto_sign_BYTES)
  sodium.crypto_sign(sigAndPayload, payload, secretKey)
}

// buf is a buffer that is exactly as large as the message (i.e. no overshooting placegholder bytes after message
// payload)
function verify (buf, publicKey) {
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
