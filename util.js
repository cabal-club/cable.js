// SPDX-FileCopyrightText: 2023 the cabal-club authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

const b4a = require("b4a")
// takes the json structure produced by generateKeypair and returns a serialized string representation 
// where the buffers have been correctly serialized as hex strings
function serializeKeypair(kp) {
  const json = { 
    publicKey: b4a.toString(kp.publicKey, "hex"), 
    secretKey: b4a.toString(kp.secretKey, "hex"), 
  }
  return JSON.stringify(json)
}

// takes the json string representation returned by serializeKeypair and converts 
// into the structure produced by generateKeypair()
function deserializeKeypair(input) {
  const json = JSON.parse(input)
  const kp = {
    publicKey: b4a.from(json.publicKey, "hex"), 
    secretKey: b4a.from(json.secretKey, "hex"), 
  }
  return kp
}

module.exports = {
  serializeKeypair,
  deserializeKeypair
}
