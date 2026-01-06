// ==UserScript==
// @name        X to Nitter Redirector
// @namespace   Violentmonkey Scripts
// @match       *://twitter.com/*
// @match       *://x.com/*
// @grant       none
// @version     1.0
// @author      Gemini
// @description x.com と twitter.com を Nitter インスタンスに自動リダイレクトします。
// @run-at      document-start
// ==/UserScript==

(function() {
    'use strict';

    // 使用するNitterインスタンス（稼働中のものに適宜書き換えてください）
    const NITTER_INSTANCE = 'nitter.poast.org';

    // 現在のURLを取得
    const currentUrl = window.location.href;

    // リダイレクト処理
    if (currentUrl.includes('twitter.com') || currentUrl.includes('x.com')) {
        const newUrl = currentUrl
            .replace('twitter.com', NITTER_INSTANCE)
            .replace('x.com', NITTER_INSTANCE);
        
        window.location.replace(newUrl);
    }
})();