// SPDX-FileCopyrightText: 2023 the cable.js authors
//
// SPDX-License-Identifier: LGPL-3.0-or-later

const sodium = require("sodium-universal")
/*
RESPONSE TYPES
0. hash response
1. post response

REQUEST TYPES
2. post request
3. cancel request
4. request channel time range
5. request channel state
6. request channel list

POST TYPES
0. post/text 
1. post/delete
2. post/info
3. post/topic
4. post/join
5. post/leave
*/

/* TYPE FIELD VALUES */
/* Response types */
// 0. hash response
const HASH_RESPONSE = 0 
/* 1. post response */
const POST_RESPONSE = 1 
// 7. channel list response
const CHANNEL_LIST_RESPONSE = 7

/* Request types */
// 2. post request
const POST_REQUEST = 2
// 3. cancel request
const CANCEL_REQUEST = 3
// 4. request channel time range
const TIME_RANGE_REQUEST = 4
// 5. request channel state
const CHANNEL_STATE_REQUEST = 5
// 6. request channel list
const CHANNEL_LIST_REQUEST = 6
// 7. is channel list response, see above
// 8. moderation state request
const MODERATION_STATE_REQUEST = 8

/* TYPE_POST FIELD VALUES */
const TEXT_POST = 0
const DELETE_POST = 1
const INFO_POST = 2
const TOPIC_POST = 3
const JOIN_POST = 4
const LEAVE_POST = 5
const ROLE_POST = 6 // post/role
const MODERATION_POST = 7
const BLOCK_POST = 8
const UNBLOCK_POST = 9

/* POST/MODERATION ACTION TYPES */
const ACTION_HIDE_USER       = 0
const ACTION_UNHIDE_USER     = 1
const ACTION_HIDE_POST       = 2
const ACTION_UNHIDE_POST     = 3
const ACTION_DROP_POST       = 4
const ACTION_UNDROP_POST     = 5
const ACTION_DROP_CHANNEL    = 6
const ACTION_UNDROP_CHANNEL  = 7

const USER_FLAG = 2
const MOD_FLAG = 1
const ADMIN_FLAG = 0

const CABAL_CONTEXT = `\u0000` // non-specified constant signifying "post context was entire cabal"

const MAX_VARINT_SIZE = 10 // according to cryptix in svendborg :)

const REQID_SIZE = 4
const CIRCUITID_SIZE = 4
const HASH_SIZE = sodium.crypto_generichash_BYTES
const PUBLICKEY_SIZE = sodium.crypto_sign_PUBLICKEYBYTES
const SECRETKEY_SIZE = sodium.crypto_sign_SECRETKEYBYTES
const SIGNATURE_SIZE = sodium.crypto_sign_BYTES

// cable specification max sizes wrt bytes and codepoints
const USER_NAME_MIN_CODEPOINTS = 1
const USER_NAME_MAX_CODEPOINTS = 32

const CHANNEL_NAME_MIN_CODEPOINTS = 1
const CHANNEL_NAME_MAX_CODEPOINTS = 64

const POST_TEXT_MAX_BYTES = 4096

const INFO_KEY_MIN_CODEPOINTS = 1
const INFO_KEY_MAX_CODEPOINTS = 128
const INFO_VALUE_MAX_BYTES = 4096

const TOPIC_MIN_CODEPOINTS = 0
const TOPIC_MAX_CODEPOINTS = 512

const REASON_MIN_CODEPOINTS = 0
const REASON_MAX_CODEPOINTS = 128

const RECIPIENT_COUNT_MIN = 1
const RECIPIENT_COUNT_MAX = 16

const INFO_DEFAULT_NAME = ""
const INFO_DEFAULT_ACCEPT_ROLE = 1

module.exports = {
  HASH_RESPONSE,
  POST_RESPONSE,
  CHANNEL_LIST_RESPONSE,

  POST_REQUEST,
  CANCEL_REQUEST,
  TIME_RANGE_REQUEST,
  CHANNEL_STATE_REQUEST,
  CHANNEL_LIST_REQUEST,
  MODERATION_STATE_REQUEST,

  TEXT_POST,
  DELETE_POST,
  INFO_POST,
  TOPIC_POST,
  JOIN_POST,
  LEAVE_POST,
  ROLE_POST,
  MODERATION_POST,
  BLOCK_POST,
  UNBLOCK_POST,

  ACTION_HIDE_USER,
  ACTION_UNHIDE_USER,
  ACTION_HIDE_POST,
  ACTION_UNHIDE_POST,
  ACTION_DROP_POST,
  ACTION_UNDROP_POST,
  ACTION_DROP_CHANNEL,
  ACTION_UNDROP_CHANNEL,

  USER_FLAG,
  MOD_FLAG,
  ADMIN_FLAG,

  MAX_VARINT_SIZE,
  REQID_SIZE,
  CIRCUITID_SIZE,
  HASH_SIZE,
  PUBLICKEY_SIZE,
  SECRETKEY_SIZE,
  SIGNATURE_SIZE,

  USER_NAME_MIN_CODEPOINTS,
  USER_NAME_MAX_CODEPOINTS,
  CHANNEL_NAME_MIN_CODEPOINTS,
  CHANNEL_NAME_MAX_CODEPOINTS,
  POST_TEXT_MAX_BYTES,
  INFO_KEY_MIN_CODEPOINTS,
  INFO_KEY_MAX_CODEPOINTS,
  INFO_VALUE_MAX_BYTES,
  TOPIC_MIN_CODEPOINTS,
  TOPIC_MAX_CODEPOINTS,
  REASON_MIN_CODEPOINTS,
  REASON_MAX_CODEPOINTS,
  RECIPIENT_COUNT_MIN,
  RECIPIENT_COUNT_MAX,

  CABAL_CONTEXT,
  INFO_DEFAULT_NAME, 
  INFO_DEFAULT_ACCEPT_ROLE
}
