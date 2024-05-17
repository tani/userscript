// ==UserScript==
// @name        Zoom.us Web Client
// @namespace   masaya.taniguchi
// @match       https://*.zoom.us/j/*
// @grant       none
// @version     1.0
// @author      Masaya Taniguchi
// @description 5/17/2024, 3:14:53 PM
// ==/UserScript==

window.location.href = window.location.href.replace(".us/j/", ".us/wc/join/")
