<!--
SPDX-FileCopyrightText: 2023 the cabal-club authors

SPDX-License-Identifier: CC0-1.0
-->

# cable.js
**status**: alpha (subject to changes)

This library contains everything needed to generate all posts and message types of the [Cable protocol](https://github.com/cabal-club/cable).

**Reponsibilities**:

* Encoding and decoding binary payloads corresponding to all cable posts and messages 
    * each post and message type can be encoded to binary with `create(<required fields>)` and decoded with `toJSON(buf)`
* Validating the requirements of each post and message type, adhering to cable specification's defined values (see [`./validation.js`](./validation.js))
* Encapsulates all cryptography needed for interacting with cable (see [`./cryptography.js`](./cryptography.js)) peers 
* Encapsulates all constants needed for interacting with cable (see
  [`./constants.js`](./constants.js))

**Non-responsibilities**:

* Does not take care of storage, indexing or any kind of persistence functions (see
  [`cable-core.js`](https://github.com/cabal-club/cable-core.js/))
* Does not provide any client specific functions (the upcoming `cable-client.js` library will take care of that)
* Does not handle networking (up and coming for cable-core.js)

## Usage

```js
const cable = require("cable")
// each class is exported and all of its methods are static, so you can alias the
// class name to save a bit of typing
const POST_REQUEST = cable.POST_REQUEST
const TEXT_POST = cable.TEXT_POST
```
### Create a binary payload 
To create a binary payload, call the `.create()` method of the corresponding post or message
type you want with the parameters required by that type. The result will be a
[`b4a`](https://github.com/holepunchto/b4a)-produced buffer meaning it will be a:

* [nodejs Buffer](https://nodejs.org/api/buffer.html) when running in node
* a [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) when running in the browser

#### Request-type messages
```js
const buf = POST_REQUEST.create(reqid, ttl, hashes)
const buf = CANCEL_REQUEST.create(reqid, ttl, cancelid)
const buf = TIME_RANGE_REQUEST.create(reqid, ttl, channel, timeStart, timeEnd, limit)
const buf = CHANNEL_STATE_REQUEST.create(reqid, ttl, channel, future)
const buf = CHANNEL_LIST_REQUEST.create(reqid, ttl, argOffset, limit)
```
#### Response-type messages
```js
const buf = HASH_RESPONSE.create(reqid, hashes)
const buf = POST_RESPONSE.create(reqid, posts)
const buf = CHANNEL_LIST_RESPONSE.create(reqid, channels)
```
#### Post types
```js
const buf = TEXT_POST.create(publicKey, secretKey, links, channel, timestamp, text)
const buf = DELETE_POST.create(publicKey, secretKey, links, timestamp, hashes)
const buf = INFO_POST.create(publicKey, secretKey, links, timestamp, key, value)
const buf = TOPIC_POST.create(publicKey, secretKey, links, channel, timestamp, topic)
const buf = JOIN_POST.create(publicKey, secretKey, links, channel, timestamp)
const buf = LEAVE_POST.create(publicKey, secretKey, links, channel, timestamp)
```
### Decode a binary payload into a JSON object
All decoding works the same way, regardless of the message type or post type. The method
`.toJSON(buf)` takes as its single argument the binary buffer to decode, and returns a JSON
object.

For the fields of each produced object, see section Examples below.

#### Request-type messages
```js
const obj = POST_REQUEST.toJSON(buf)
const obj = CANCEL_REQUEST.toJSON(buf)
const obj = TIME_RANGE_REQUEST.toJSON(buf)
const obj = CHANNEL_STATE_REQUEST.toJSON(buf)
const obj = CHANNEL_LIST_REQUEST.toJSON(buf)
```
#### Response-type messages
```js
const obj = HASH_RESPONSE.toJSON(buf)
const obj = POST_RESPONSE.toJSON(buf)
const obj = CHANNEL_LIST_RESPONSE.toJSON(buf)
```
#### Post types
```js
const obj = TEXT_POST.toJSON(buf)
const obj = DELETE_POST.toJSON(buf)
const obj = INFO_POST.toJSON(buf)
const obj = TOPIC_POST.toJSON(buf)
const obj = JOIN_POST.toJSON(buf)
const obj = LEAVE_POST.toJSON(buf)
```


## Examples
The following example shows each post type, request type, and response type alongside the
parameters (see `initial-parameters`) necessary for generating them. You can generate this
output yourself by running `node complete-examples.js`

How to understand the example: 

Each json object (not including `initial-parameters`) describes a particular post or message
cable is capable of generating. 

* The `name` and `type` fields of each object describes the post/message type. 
* The `id` field is the canonical numerical description corresponding to what `msg_type` (requests/responses) or `post_type` (posts) is being presented. See the [cable spec](https://github.com/cabal-club/cable#table-of-contents) for the full listing of types.
* The `binary` field is the hex-encoded binary representation of the full post/message. 
* The `obj` field is the json representation produced by this repository's library when parsing
  the corresponding binary representation.

```json
{
  "name": "initial-parameters",
  "type": "generated-data",
  "id": -1,
  "binary": null,
  "obj": {
    "keypair": {
      "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
      "secretKey": "f12a0b72a720f9ce6898a1f4c685bee4cc838102143db98f467c5512a726e69225b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0"
    },
    "hashes": [
      "20265674e8aac2dfddd78f86fe5a3dd68d976ca3f5ba23645ec7381480921d0d",
      "10705340e5528f2ef03a6797b72b1bb9f37f9009ad408247387c4bcc4d2a3371",
      "af700793dd51d4cb3c18a6df46f88bfe1665fba9b277487ddecd1e031441d69d"
    ],
    "reqid": "95050429",
    "cancelid": "58b041b1",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "ttl": 1,
    "limit": 20,
    "timestamp": 80,
    "timeStart": 0,
    "timeEnd": 100,
    "future": 0,
    "channels": [
      "default",
      "dev",
      "introduction"
    ],
    "channel": "default",
    "username": "cabler",
    "offset": 0,
    "text": "h€llo world",
    "topic": "introduce yourself to the friendly crowd of likeminded folx"
  }
}
{
  "name": "hash response",
  "type": "response",
  "id": 2,
  "binary": "6b020000000095050429010320265674e8aac2dfddd78f86fe5a3dd68d976ca3f5ba23645ec7381480921d0d10705340e5528f2ef03a6797b72b1bb9f37f9009ad408247387c4bcc4d2a3371af700793dd51d4cb3c18a6df46f88bfe1665fba9b277487ddecd1e031441d69d",
  "obj": {
    "msgLen": 107,
    "msgType": 2,
    "reqid": "95050429",
    "ttl": 1,
    "hashes": [
      "20265674e8aac2dfddd78f86fe5a3dd68d976ca3f5ba23645ec7381480921d0d",
      "10705340e5528f2ef03a6797b72b1bb9f37f9009ad408247387c4bcc4d2a3371",
      "af700793dd51d4cb3c18a6df46f88bfe1665fba9b277487ddecd1e031441d69d"
    ]
  }
}
{
  "name": "cancel request",
  "type": "request",
  "id": 3,
  "binary": "0e0300000000950504290158b041b1",
  "obj": {
    "msgLen": 14,
    "msgType": 3,
    "reqid": "95050429",
    "ttl": 1,
    "cancelid": "58b041b1"
  }
}
{
  "name": "channel time range request",
  "type": "request",
  "id": 4,
  "binary": "15040000000095050429010764656661756c74006414",
  "obj": {
    "msgLen": 21,
    "msgType": 4,
    "reqid": "95050429",
    "ttl": 1,
    "channel": "default",
    "timeStart": 0,
    "timeEnd": 100,
    "limit": 20
  }
}
{
  "name": "channel state request",
  "type": "request",
  "id": 5,
  "binary": "13050000000095050429010764656661756c7400",
  "obj": {
    "msgLen": 19,
    "msgType": 5,
    "reqid": "95050429",
    "ttl": 1,
    "channel": "default",
    "future": 0
  }
}
{
  "name": "channel list request",
  "type": "request",
  "id": 6,
  "binary": "0c060000000095050429010014",
  "obj": {
    "msgLen": 12,
    "msgType": 6,
    "reqid": "95050429",
    "ttl": 1,
    "offset": 0,
    "limit": 20
  }
}
{
  "name": "hash response",
  "type": "response",
  "id": 0,
  "binary": "6a0000000000950504290320265674e8aac2dfddd78f86fe5a3dd68d976ca3f5ba23645ec7381480921d0d10705340e5528f2ef03a6797b72b1bb9f37f9009ad408247387c4bcc4d2a3371af700793dd51d4cb3c18a6df46f88bfe1665fba9b277487ddecd1e031441d69d",
  "obj": {
    "msgLen": 106,
    "msgType": 0,
    "reqid": "95050429",
    "hashes": [
      "20265674e8aac2dfddd78f86fe5a3dd68d976ca3f5ba23645ec7381480921d0d",
      "10705340e5528f2ef03a6797b72b1bb9f37f9009ad408247387c4bcc4d2a3371",
      "af700793dd51d4cb3c18a6df46f88bfe1665fba9b277487ddecd1e031441d69d"
    ]
  }
}
{
  "name": "post response",
  "type": "response",
  "id": 1,
  "binary": "97010100000000950504298b0125b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0abb083ecdca569f064564942ddf1944fbf550dc27ea36a7074be798d753cb029703de77b1a9532b6ca2ec5706e297dce073d6e508eeb425c32df8431e4677805015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b305500764656661756c7400",
  "obj": {
    "msgLen": 151,
    "msgType": 1,
    "reqid": "95050429",
    "posts": [
      "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0abb083ecdca569f064564942ddf1944fbf550dc27ea36a7074be798d753cb029703de77b1a9532b6ca2ec5706e297dce073d6e508eeb425c32df8431e4677805015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b305500764656661756c74"
    ]
  }
}
{
  "name": "channel list response",
  "type": "response",
  "id": 7,
  "binary": "230700000000950504290764656661756c74036465760c696e74726f64756374696f6e00",
  "obj": {
    "msgLen": 35,
    "msgType": 7,
    "reqid": "95050429",
    "channels": [
      "default",
      "dev",
      "introduction"
    ]
  }
}
{
  "name": "post/text",
  "type": "post",
  "id": 0,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d06725733046b35fa3a7e8dc0099a2b3dff10d3fd8b0f6da70d094352e3f5d27a8bc3f5586cf0bf71befc22536c3c50ec7b1d64398d43c3f4cde778e579e88af05015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b300500764656661756c740d68e282ac6c6c6f20776f726c64",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "6725733046b35fa3a7e8dc0099a2b3dff10d3fd8b0f6da70d094352e3f5d27a8bc3f5586cf0bf71befc22536c3c50ec7b1d64398d43c3f4cde778e579e88af05",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 0,
    "channel": "default",
    "timestamp": 80,
    "text": "h€llo world"
  }
}
{
  "name": "post/delete",
  "type": "post",
  "id": 1,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0e8fc6c809f3086627879520abe6f76a4810a8bef77a668f41046c48dc98c13ed55aa54ca1e6913076bd7791c6c97aa807850bc6be7415fa5d251b9b26febd101015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b301500320265674e8aac2dfddd78f86fe5a3dd68d976ca3f5ba23645ec7381480921d0d10705340e5528f2ef03a6797b72b1bb9f37f9009ad408247387c4bcc4d2a3371af700793dd51d4cb3c18a6df46f88bfe1665fba9b277487ddecd1e031441d69d",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "e8fc6c809f3086627879520abe6f76a4810a8bef77a668f41046c48dc98c13ed55aa54ca1e6913076bd7791c6c97aa807850bc6be7415fa5d251b9b26febd101",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 1,
    "timestamp": 80,
    "hashes": [
      "20265674e8aac2dfddd78f86fe5a3dd68d976ca3f5ba23645ec7381480921d0d",
      "10705340e5528f2ef03a6797b72b1bb9f37f9009ad408247387c4bcc4d2a3371",
      "af700793dd51d4cb3c18a6df46f88bfe1665fba9b277487ddecd1e031441d69d"
    ]
  }
}
{
  "name": "post/info",
  "type": "post",
  "id": 2,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d04ccb1c0063ef09a200e031ee89d874bcc99f3e6fd8fd667f5e28f4dbcf4b7de6bb1ce37d5f01cc055a7b70cef175d30feeb34531db98c91fa8b3fa4d7c5fd307015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b30250046e616d65066361626c657200",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "4ccb1c0063ef09a200e031ee89d874bcc99f3e6fd8fd667f5e28f4dbcf4b7de6bb1ce37d5f01cc055a7b70cef175d30feeb34531db98c91fa8b3fa4d7c5fd307",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 2,
    "timestamp": 80,
    "key": "name",
    "value": "cabler"
  }
}
{
  "name": "post/topic",
  "type": "post",
  "id": 3,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0bf7578e781caee4ca708281645b291a2100c4f2138f0e0ac98bc2b4a414b4ba8dca08285751114b05f131421a1745b648c43b17b05392593237dfacc8dff5208015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b303500764656661756c743b696e74726f6475636520796f757273656c6620746f2074686520667269656e646c792063726f7764206f66206c696b656d696e64656420666f6c78",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "bf7578e781caee4ca708281645b291a2100c4f2138f0e0ac98bc2b4a414b4ba8dca08285751114b05f131421a1745b648c43b17b05392593237dfacc8dff5208",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 3,
    "channel": "default",
    "timestamp": 80,
    "topic": "introduce yourself to the friendly crowd of likeminded folx"
  }
}
{
  "name": "post/join",
  "type": "post",
  "id": 4,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d064425f10fa34c1e14b6101491772d3c5f15f720a952dd56c27d5ad52f61f695130ce286de73e332612b36242339b61c9e12397f5dcc94c79055c7e1cb1dbfb08015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b304500764656661756c74",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "64425f10fa34c1e14b6101491772d3c5f15f720a952dd56c27d5ad52f61f695130ce286de73e332612b36242339b61c9e12397f5dcc94c79055c7e1cb1dbfb08",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 4,
    "channel": "default",
    "timestamp": 80
  }
}
{
  "name": "post/leave",
  "type": "post",
  "id": 5,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0abb083ecdca569f064564942ddf1944fbf550dc27ea36a7074be798d753cb029703de77b1a9532b6ca2ec5706e297dce073d6e508eeb425c32df8431e4677805015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b305500764656661756c74",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "abb083ecdca569f064564942ddf1944fbf550dc27ea36a7074be798d753cb029703de77b1a9532b6ca2ec5706e297dce073d6e508eeb425c32df8431e4677805",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 5,
    "channel": "default",
    "timestamp": 80
  }
}
```
