// ==UserScript==
// @name        BIZ UD Fonts
// @namespace   tani.github.io
// @match       *://*/*
// @grant       none
// @version     1.0
// @author      Masaya Taniguchi
// @description 2023/10/18 22:39:36
// ==/UserScript==

// 全ての要素に対してフォントスタイルを変更
for (const element of document.querySelectorAll("*")) {
    const computedStyle = getComputedStyle(element);
    const currentFontFamily = computedStyle.getPropertyValue('font-family');
    element.style.fontFamily = currentFontFamily
      .replace('"BIZ UDP Mincho", serif', 'serif')
      .replace(/(?<!-)serif/, '"BIZ UDP Mincho", serif')
      .replace('"BIZ UDPGothic", sans-serif', 'sans-serif')
      .replace('sans-serif', '"BIZ UDPGothic", sans-serif');
}
