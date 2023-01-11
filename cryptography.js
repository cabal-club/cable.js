const b4a = require("b4a")
const sodium = require("sodium-universal")

function generateReqID() {
  // alloc buf with 4 bytes
  const buf = b4a.alloc(4)
  // fill buffer with cryptograhically random bytes
  sodium.randombytes_buf(buf)
  return buf
}

function hash(buf) {
  const output = b4a.alloc(sodium.crypto_generichash_BYTES)
  sodium.crypto_generichash(output, buf)
  return output
}

module.exports = {
  generateReqID,
  hash
}
