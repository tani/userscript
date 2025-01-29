// ==UserScript==
// @name             notranslate
// @match            *://*/*
// @version          1.0
// ==/UserScript==


document.querySelectorAll("math, code").forEach(element => {
  element.setAttribute("translate", "no");
  element.classList.add("notranslate");
});
