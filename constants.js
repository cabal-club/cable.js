const sodium = require("sodium-universal")
/*
RESPONSE TYPES
0. hash response
1. data response

REQUEST TYPES
2. request by hash
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
/* 1. data response */
const DATA_RESPONSE = 1 

/* Request types */
// 2. request by hash
const HASH_REQUEST = 2
// 3. cancel request
const CANCEL_REQUEST = 3
// 4. request channel time range
const TIME_RANGE_REQUEST = 4
// 5. request channel state
const CHANNEL_STATE_REQUEST = 5
// 6. request channel list
const CHANNEL_LIST_REQUEST = 6

/* TYPE_POST FIELD VALUES */
const TEXT_POST = 0
const DELETE_POST = 1
const INFO_POST = 2
const TOPIC_POST = 3
const JOIN_POST = 4
const LEAVE_POST = 5

const MAX_VARINT_SIZE = 10 // according to cryptix in svendborg :)

const DEFAULT_BUFFER_SIZE = 1024

const REQID_SIZE = 4
const HASH_SIZE = sodium.crypto_generichash_BYTES
const PUBLICKEY_SIZE = sodium.crypto_sign_PUBLICKEYBYTES
const SECRETKEY_SIZE = sodium.crypto_sign_SECRETKEYBYTES
const SIGNATURE_SIZE = sodium.crypto_sign_BYTES

module.exports = {
  HASH_RESPONSE,
  DATA_RESPONSE,

  HASH_REQUEST,
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

  DEFAULT_BUFFER_SIZE,
  MAX_VARINT_SIZE,
  REQID_SIZE,
  HASH_SIZE,
  PUBLICKEY_SIZE,
  SECRETKEY_SIZE,
  SIGNATURE_SIZE
}
