const b4a = require("b4a")
const crypto = require("./cryptography.js")
const cable = require("./index.js")

const TEXT_POST = cable.TEXT_POST

function printPostText(obj) {
  const keys = ["publicKey", "signature", "links", "postType", "channel", "timestamp", "text"]
  keys.forEach(key => {
    const val = obj[key]
    console.log(`  ${key}:`)
    if (b4a.isBuffer(val)) {
      console.log("    " + val.toString("hex"))
    } else if (key === "links") {
      console.log("    " + val.map(link => link.toString("hex")))
    } else {
      console.log("    " + val)
    }
  })
}

function convertPostFields (obj) {
  const fields = []
  const keys = ["publicKey", "signature", "links", "postType", "channel", "timestamp", "text"]
  keys.forEach(key => {
    const val = obj[key]
    let representation = val
    if (b4a.isBuffer(val)) {
      representation = val.toString("hex")
    } else if (key === "links") {
      const len = val.length
      fields.push({ key: `numLinks`, value: len })
      representation = JSON.stringify(val.map(link => link.toString("hex")))
    } else if (typeof val === "string") {
      const len = b4a.from(val).length
      fields.push({key: `${key}Len`, value: len})
    }
    fields.push({key, value: representation})
  })
  return fields
}

function machineReadableFormat(kp, buf, obj) {
  const rep = {
    publicKey: kp.publicKey.toString("hex"), 
    privateKey: kp.secretKey.toString("hex"), 
    binary: buf.toString("hex"),
    fields: convertPostFields(obj)
  }
  console.log(rep)
}


const keypair = crypto.generateKeypair()
console.log("public key:\n" + keypair.publicKey.toString("hex"))
console.log()
console.log("private key:\n" + keypair.secretKey.toString("hex"))
const link = crypto.hash(b4a.from("a fake post payload"))
const date = (new Date("2023-04-18")).getTime() // milliseconds since epoch

// 0: post/text
const bufText = TEXT_POST.create(keypair.publicKey, keypair.secretKey, [link], "introduction", date, "h€llo world")
console.log()
console.log("post/text binary:\n" + bufText.toString("hex"))
const objText = TEXT_POST.toJSON(bufText)
console.log()
console.log("post/text fields representation")
printPostText(objText)

machineReadableFormat(keypair, bufText, objText)
