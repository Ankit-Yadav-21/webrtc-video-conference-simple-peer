const express = require('express')
const app = express()
const http = require('http')

const port = process.env.PORT || 4000

require('./routes')(app)

const Server = http.createServer(app)
const io = require('socket.io')(Server)
require('./socketController')(io)

Server.listen(port, () => {
    console.log(`listening on port ${port}`)
})
