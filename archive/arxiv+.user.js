// ==UserScript==
// @name arXiv File Namer
// @namespace Violentmonkey Scripts
// @match https://arxiv.org/abs/*
// @grant GM_xmlhttpRequest
// @grant GM_download
// ==/UserScript==
const id = location.href.replace(/.*\//,"")
GM_xmlhttpRequest({
  method: "GET",
  responseType: "json",
  url: `https://api.altmetric.com/v1/arxiv/${id}`,
  onload: ({response}) => {
    const anchor = document.querySelector("a[href^='/pdf/']")
    const author = response.authors[0].replace(/.* /,"")
    const published_on = new Date(response.published_on * 1000)
    const url = anchor.href
    const year = published_on.getFullYear()
    const name = `${author}${year}.pdf`
    anchor.onclick = () => {
      GM_download(url, name)
      return false
    }
  }
})
