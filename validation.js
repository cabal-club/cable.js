// SPDX-FileCopyrightText: 2023 the cable.js authors
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

function checkReason (reasonBuf) {
  const correctlySized = isBufferSizeMin(reasonBuf, constants.REASON_MIN_CODEPOINTS) && isBufferSizeMax(reasonBuf, constants.REASON_MAX_CODEPOINTS)
  if (!correctlySized) { throw codepointRangeExpected("REASON", constants.REASON_MIN_CODEPOINTS, constants.REASON_MAX_CODEPOINTS, reasonBuf.length) }
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

function checkAcceptRole (valueBuf) {
  const acceptedValues = b4a.equals(b4a.from([1]), valueBuf) || b4a.equals(b4a.from([0]), valueBuf)
  if (!acceptedValues) { throw new Error(`expected 'accept-role' to be a buffer containing value 0 or 1; was ${valueBuf}`) }
}

function checkFuture (value) {
  const acceptedValues = (value === 0 || value === 1)
  if (!acceptedValues) { throw new Error(`expected 'future' to contain either value 0 or 1; was ${value}`) }
}

function checkInfoKey(keyBuf) {
  const correctlySized = isBufferSizeMin(keyBuf, constants.INFO_KEY_MIN_CODEPOINTS) && isBufferSizeMax(keyBuf, constants.INFO_KEY_MAX_CODEPOINTS)
  if (!correctlySized) { throw codepointRangeExpected("key", constants.INFO_KEY_MIN_CODEPOINTS, constants.INFO_KEY_MAX_CODEPOINTS, keyBuf.length) }
}

function checkPostText(textBuf) {
  const correctlySized = isBufferSizeMax(textBuf, constants.POST_TEXT_MAX_BYTES)
  if (!correctlySized) { throw new bufferExpectedMax("text", constants.POST_TEXT_MAX_BYTES, textBuf.len) }
}

function checkRecipientsLength (recipients) {
    if (recipients.length > constants.RECIPIENT_COUNT_MAX) {
      throw new Error("recipients length exceeded max of 16")
    }
    if (recipients.length < constants.RECIPIENT_COUNT_MIN) {
      throw new Error("recipients length below min of 1")
    }
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
  checkAcceptRole,
  checkTopic,
  checkChannelName,
  checkReason,
  checkRecipientsLength,
  checkFuture
}
