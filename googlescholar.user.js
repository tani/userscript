// ==UserScript==
// @name        Google Scholar Plus
// @namespace   masaya.taniguchi
// @match       https://scholar.google.com/*
// @match       https://scholar.google.co.jp/*
// @match       https://scholar.google.jp/*
// @version     1.1
// @author      TANIGUCHI Masaya
// @description 2020/1/14 10:46:29
// @run-at document-idle
// @grant GM_xmlhttpRequest
// @grant GM_download
// @require https://cdn.jsdelivr.net/npm/bibtex-parser-js@0.0.2/bibtexParse.min.js
// ==/UserScript==

const retrieveBibTeX = (id) => {
  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://scholar.google.com/scholar?q=info:${id}:scholar.google.com/&output=cite`,
      onload({responseText}) {
        const domParser = new DOMParser();
        const info = domParser.parseFromString(responseText, 'text/html');
        GM_xmlhttpRequest({
          method: 'GET',
          url: info.querySelector('[href*="scholar.bib"]').getAttribute('href'),
          onload({responseText}) {
            resolve(responseText);
          }
        });
      }
    });
  });
};

document
  .querySelectorAll('[data-cid]:not([id])')
  .forEach((element) => {
    const a = document.createElement('a');
    a.innerHTML = '🔖';
    a.href = 'javascript:void(0)';
    a.style = 'padding: 0 1em; font-size: small;';
    a.classList.add('gsp-copy-bibtex');
    a.onclick = async () => {
      const bibtex = await retrieveBibTeX(element.dataset.cid);
      navigator.clipboard.writeText(bibtex);
    };
    element.querySelector('h3').appendChild(a);
    element.querySelectorAll("a").forEach((a)=>{
      if(a.innerHTML.match(/\[PDF\]/)) {
        const url = a.href;
        a.href = 'javascript:void(0)';
        a.parentNode.setAttribute('ontouchstart', null);
        a.onclick = async () => {
          const bibtex = await retrieveBibTeX(element.dataset.cid);
          const {citationKey} = bibtexParse.toJSON(bibtex)[0];
          GM_download(url, `${citationKey.toLowerCase()}.pdf`);
          return false
        }
      }
    });
  });
