// ==UserScript==
// @name             notranslate
// @match            *://*/*
// @version          1.0
// ==/UserScript==

for (const element of document.querySelectorAll('math, code')) {
  element.setAttribute('translate', 'no');
  element.classList.add('notranslate');
}
