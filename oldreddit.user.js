// ==UserScript==
// @name        Reddit Classic
// @namespace   Violentmonkey Scripts
// @match       https://www.reddit.com/*
// @grant       none
// @version     1.0
// @author      Masaya Taniguchi
// @description 5/17/2024, 3:59:43 PM
// ==/UserScript==

window.location.href = window.location.href.replace("www.reddit.com/", "old.reddit.com/")
