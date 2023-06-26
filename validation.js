// SPDX-FileCopyrightText: 2023 the cabal-club authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

const b4a = require("b4a")
const crypto = require("./cryptography.js")
const constants = require("./constants.js")

function isBufferSizeMin(b, MIN_SIZE) {
  if (b4a.isBuffer(b)) {
    return b.length >= MIN_SIZE
  }
  return false
}

function isBufferSizeMax(b, MAX_SIZE) {
  if (b4a.isBuffer(b)) {
    return b.length <= MAX_SIZE
  }
  return false
}

function codepointRangeExpected (param, min, max, actual) {
  return new Error(`expected ${param} to be between ${min} and ${max} codepoints; was ${actual}`)
}

function checkChannelName (channelBuf) {
  const correctlySized = isBufferSizeMin(channelBuf, constants.CHANNEL_NAME_MIN_CODEPOINTS) && isBufferSizeMax(channelBuf, constants.CHANNEL_NAME_MAX_CODEPOINTS)
  if (!correctlySized) { throw codepointRangeExpected("channel", constants.TOPIC_MIN_CODEPOINTS, constants.TOPIC_MAX_CODEPOINTS, channelBuf.length) }
}

function checkTopic(topicBuf) {
  const correctlySized = isBufferSizeMin(topicBuf, constants.TOPIC_MIN_CODEPOINTS) && isBufferSizeMax(topicBuf, constants.TOPIC_MAX_CODEPOINTS)
  if (!correctlySized) { throw codepointRangeExpected("topic", constants.TOPIC_MIN_CODEPOINTS, constants.TOPIC_MAX_CODEPOINTS, topicBuf.length) }
}

function checkUsername(valueBuf) {
  const correctlySized = isBufferSizeMin(valueBuf, constants.USER_NAME_MIN_CODEPOINTS) && isBufferSizeMax(valueBuf, constants.USER_NAME_MAX_CODEPOINTS)
  if (!correctlySized) { throw codepointRangeExpected("name", constants.USER_NAME_MIN_CODEPOINTS, constants.USER_NAME_MAX_CODEPOINTS, valueBuf.length) }
}

function checkInfoValue (valueBuf) {
  const correctlySized = isBufferSizeMax(valueBuf, constants.INFO_VALUE_MAX_BYTES)
  if (!correctlySized) { throw new bufferExpectedMax("value", constants.INFO_VALUE_MAX_BYTES, textBuf.len) }
}

function checkInfoKey(keyBuf) {
  const correctlySized = isBufferSizeMin(keyBuf, constants.INFO_KEY_MIN_CODEPOINTS) && isBufferSizeMax(keyBuf, constants.INFO_KEY_MAX_CODEPOINTS)
  if (!correctlySized) { throw codepointRangeExpected("key", constants.INFO_KEY_MIN_CODEPOINTS, constants.INFO_KEY_MAX_CODEPOINTS, keyBuf.length) }
}

function checkPostText(textBuf) {
  const correctlySized = isBufferSizeMax(textBuf, constants.POST_TEXT_MAX_BYTES)
  if (!correctlySized) { throw new bufferExpectedMax("text", constants.POST_TEXT_MAX_BYTES, textBuf.len) }
}

function checkSignature (message, publicKey) {
  const signatureCorrect = crypto.verify(message, publicKey)
  if (!signatureCorrect) { 
    throw new Error("could not verify signature created with keypair publicKey + secretKey") 
  }
}

module.exports = {
  checkSignature,
  checkPostText,
  checkInfoKey,
  checkInfoValue,
  checkUsername,
  checkTopic,
  checkChannelName
}
