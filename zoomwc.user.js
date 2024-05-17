// ==UserScript==
// @name        Zoom.us Web Client
// @namespace   masaya.taniguchi
// @match       https://*.zoom.us/*
// @grant       none
// @version     1.0
// @author      Masaya Taniguchi
// @description 5/17/2024, 3:14:53 PM
// ==/UserScript==

if (window.location.href.indexOf(".us/j/") > 0) {
  window.location.href = window.location.href.replace(".us/j/", ".us/wc/join/")
}
