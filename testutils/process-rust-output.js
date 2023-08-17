const fs = require("fs")

fs.readFile("./rust-output.txt", (err, data) => {
  const map = {}
  for (const line of data.toString().split("\n")) {
    if (line.length === 0) { continue }
    const index = line.indexOf(":")
    const key = line.slice(0, index)
    var value
    if (line.slice(0,index).includes("binary")) {
      value = line.slice(index+1).trim().replace(/"/g, '')
    } else {
      value = line.slice(index+1)
      value = JSON.parse(value)
    }
    map[key] = value
  }
  console.log(JSON.stringify(map))
})
