const path = require('path')
const express = require('express')

module.exports = (app) => {
    app.use(express.static(path.join(__dirname, '..','public')))
    app.use(express.static(path.join(__dirname, '..','node_modules')))
}