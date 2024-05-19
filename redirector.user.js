// ==UserScript==
// @name        Redirector
// @namespace   masaya.taniguchi
// @match       https://www.reddit.com/*
// @match       https://*.zoom.us/j/*
// @grant       none
// @version     1.1
// @author      Masaya Taniguchi
// @description 5/17/2024, 3:59:43 PM
// @run-at      document-start
// ==/UserScript==

function redirect(from, to) {
    if (window.location.href.match(from)) {
        window.location.href = window.location.href.replace(from, to)
    }
}

redirect("www.reddit.com/", "old.reddit.com/")
redirect("zoom.us/j/", "zoom.us/wc/join/")