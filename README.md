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
const buf = MODERATION_STATE_REQUEST.create(reqid, ttl, channels, future, oldest)
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
const buf = ROLE_POST.create(publicKey, secretKey, links, channel, timestamp, recipient, role, reason, privacy)
const buf = MODERATION_POST.create(publicKey, secretKey, links, channel, timestamp, recipients, action, reason, privacy)
const buf = BLOCK_POST.create(publicKey, secretKey, links, timestamp, recipients, drop, notify, reason, privacy)
const buf = UNBLOCK_POST.create(publicKey, secretKey, links, timestamp, recipients, undrop, reason, privacy)
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
const obj = MODERATION_STATE_REQUEST.toJSON(buf)
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
const obj = ROLE_POST.toJSON(buf)
const obj = MODERATION_POST.toJSON(buf)
const obj = BLOCK_POST.toJSON(buf)
const obj = UNBLOCK_POST.toJSON(buf)
```


## Examples
The following example shows each post type, request type, and response type alongside the
parameters (see `initial-parameters`) necessary for generating them. You can generate this
output yourself by running `node complete-examples.js`

How to understand the example: 

Each json object (not including `initial-parameters`) describes a particular post or message
cable is capable of generating. 

* Fields `name` and `type` of each object describes the post/message type. 
* Field `id` is the canonical numerical description corresponding to what `msg_type` (requests/responses) or `post_type` (posts) is being presented. See the [cable spec](https://github.com/cabal-club/cable#table-of-contents) for the full listing of types.
* Field `binary` is the hex-encoded binary representation of the full post/message. 
* Field `obj` is the json representation produced by this repository's library when parsing
  the corresponding binary representation.
* Field `posthash` is the hex-encoded hash produced when hashing the entire post/message with
  [Blake2b](https://github.com/cabal-club/cable/#41-blake2b). That is, it's the Blake2b hash of
  the contents represented by field `binary`.

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
    "topic": "introduce yourself to the friendly crowd of likeminded folx",
    "oldest": 40,
    "recipients": [
      "a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e91",
      "2abcc76c670e32d37fd4233a6ea60fd39a3b246c4ac4bfd43a74639360ff7688",
      "89d1baf8b98a135e7a9ab7720dbd809e234a61054187ed8bc1022c44e45010d6"
    ],
    "recipient": "a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e91",
    "action": 0,
    "role": 0,
    "reason": "the reason is entirely mine own",
    "privacy": 0,
    "drop": 0,
    "undrop": 1,
    "notify": 1
  },
  "posthash": null
}
{
  "name": "post request",
  "type": "request",
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
  },
  "posthash": "000ec3d4c9c9fbc5522ba54fb7ebe97781d222869003ced25e8617e2e373d620"
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
  },
  "posthash": "6730710ddb5defadc7ff4a16cfc02a0ada947eb2a50c3c8c277a122f37b8e72a"
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
  },
  "posthash": "b20a8aef8b489fec5fcd84ef0f48c8ed7a9c45673f1e6307150f50accdd74330"
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
  },
  "posthash": "b54fb8c60c642d49d9072ab750cebb7525550abd3f1a51b36bbb095c5b8977db"
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
  },
  "posthash": "f0878f4a7dff80ce1936212b773c305128df0c3d0e1dae1b17f83d03771cd9e2"
}
{
  "name": "moderation state request",
  "type": "request",
  "id": 8,
  "binary": "26080000000095050429010764656661756c74036465760c696e74726f64756374696f6e000028",
  "obj": {
    "msgLen": 38,
    "msgType": 8,
    "reqid": "95050429",
    "ttl": 1,
    "channels": [
      "default",
      "dev",
      "introduction"
    ],
    "future": 0,
    "oldest": 40
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
  },
  "posthash": "d7eb301be54e29b65f52d2944d3315ee5bcd89cae125ea8907c42a6c69d7801b"
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
  },
  "posthash": "6f191ac0cd9705d6d02c28186b13a351e45e0cac80b0c926a10dd70a39d12be7"
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
  },
  "posthash": "dda7400532e7e62d3960995090fd6a14c9bb6bec1346f80c6fe8f158f7de4fda"
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
  },
  "posthash": "1971c3829f1df088fc2b0a1172174ada80c14650b679587a305dca7b1c396a39"
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
  },
  "posthash": "9617fbed0a14bf68eeda625ae853206d68a80a04527512d4ae83d88bb4722ba4"
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
    "info": [
      [
        "name",
        "cabler"
      ]
    ]
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
  },
  "posthash": "38fe6249a7465e59052d793145b8f7dafcf05188995371d766b600da8d5f8f76"
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
  },
  "posthash": "e921c9a21bc5d465e6d302851b7c62dde873301e696aefe066353d5acacb9514"
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
  },
  "posthash": "540b27c2e09a14d8405a892913bf9b2b5131db4210fe82696b5d6a12ba1fe9ed"
}
{
  "name": "post/role",
  "type": "post",
  "id": 6,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0f487aa1356906bdf71573248e4615329eaf392f0996a7decf275fcfaf30ee3a35e6ba0b2953eb17ded9c3f239d3ae2048e13c7338563bb8aef78ab74063b2100015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b306501f74686520726561736f6e20697320656e746972656c79206d696e65206f776e000764656661756c74a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e9100",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "f487aa1356906bdf71573248e4615329eaf392f0996a7decf275fcfaf30ee3a35e6ba0b2953eb17ded9c3f239d3ae2048e13c7338563bb8aef78ab74063b2100",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 6,
    "timestamp": 80,
    "reason": "the reason is entirely mine own",
    "privacy": 0,
    "channel": "default",
    "recipient": "a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e91",
    "role": 0
  }
}
{
  "name": "post/moderation",
  "type": "post",
  "id": 7,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d09ac00f42db0cfc55575800926954cfe03a15c16132ecde2a6ca8b7365a3e9eec9786c8569e287bcbfff158e584637a0ce235e541acc3bc16d28fcb1024309405015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b307501f74686520726561736f6e20697320656e746972656c79206d696e65206f776e000764656661756c7403a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e912abcc76c670e32d37fd4233a6ea60fd39a3b246c4ac4bfd43a74639360ff768889d1baf8b98a135e7a9ab7720dbd809e234a61054187ed8bc1022c44e45010d600",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "9ac00f42db0cfc55575800926954cfe03a15c16132ecde2a6ca8b7365a3e9eec9786c8569e287bcbfff158e584637a0ce235e541acc3bc16d28fcb1024309405",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 7,
    "timestamp": 80,
    "reason": "the reason is entirely mine own",
    "privacy": 0,
    "channel": "default",
    "recipients": [
      "a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e91",
      "2abcc76c670e32d37fd4233a6ea60fd39a3b246c4ac4bfd43a74639360ff7688",
      "89d1baf8b98a135e7a9ab7720dbd809e234a61054187ed8bc1022c44e45010d6"
    ],
    "action": 0
  }
}
{
  "name": "post/block",
  "type": "post",
  "id": 8,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0e5fffd29b2057983fd427b41164b9a7aeb1ff0dd770f2f21f0f253cdccca063c39c041e81727db5c87810d72a717f0ddf6689734b0d2680680067ff99ea61104015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b308501f74686520726561736f6e20697320656e746972656c79206d696e65206f776e0003a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e912abcc76c670e32d37fd4233a6ea60fd39a3b246c4ac4bfd43a74639360ff768889d1baf8b98a135e7a9ab7720dbd809e234a61054187ed8bc1022c44e45010d60001",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "e5fffd29b2057983fd427b41164b9a7aeb1ff0dd770f2f21f0f253cdccca063c39c041e81727db5c87810d72a717f0ddf6689734b0d2680680067ff99ea61104",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 8,
    "timestamp": 80,
    "reason": "the reason is entirely mine own",
    "privacy": 0,
    "recipients": [
      "a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e91",
      "2abcc76c670e32d37fd4233a6ea60fd39a3b246c4ac4bfd43a74639360ff7688",
      "89d1baf8b98a135e7a9ab7720dbd809e234a61054187ed8bc1022c44e45010d6"
    ],
    "drop": 0,
    "notify": 1
  }
}
{
  "name": "post/unblock",
  "type": "post",
  "id": 9,
  "binary": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d030ea02c39b2c41e4de986f290b9f6e20ae190fb4cf357599103315aa4040dfa297f288fe3617b3febe5faea7aa7f381ee046823bfb371c45062eabda95c6430e015049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b309501f74686520726561736f6e20697320656e746972656c79206d696e65206f776e0003a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e912abcc76c670e32d37fd4233a6ea60fd39a3b246c4ac4bfd43a74639360ff768889d1baf8b98a135e7a9ab7720dbd809e234a61054187ed8bc1022c44e45010d601",
  "obj": {
    "publicKey": "25b272a71555322d40efe449a7f99af8fd364b92d350f1664481b2da340a02d0",
    "signature": "30ea02c39b2c41e4de986f290b9f6e20ae190fb4cf357599103315aa4040dfa297f288fe3617b3febe5faea7aa7f381ee046823bfb371c45062eabda95c6430e",
    "links": [
      "5049d089a650aa896cb25ec35258653be4df196b4a5e5b6db7ed024aaa89e1b3"
    ],
    "postType": 9,
    "timestamp": 80,
    "reason": "the reason is entirely mine own",
    "privacy": 0,
    "recipients": [
      "a6bac4f48e10f3e036e3915a583977b900e048304f7527b6bf299356219d1e91",
      "2abcc76c670e32d37fd4233a6ea60fd39a3b246c4ac4bfd43a74639360ff7688",
      "89d1baf8b98a135e7a9ab7720dbd809e234a61054187ed8bc1022c44e45010d6"
    ],
    "undrop": 1
  }
}
```
