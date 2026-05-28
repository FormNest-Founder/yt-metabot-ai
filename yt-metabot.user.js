// ==UserScript==
// @name         MetaBot for YouTube
// @namespace    yt-metabot-user-js
// @description  More information about users and videos on YouTube.
// @version      230700
// @homepageURL  https://vk.com/public159378864
// @supportURL   https://github.com/asrdri/yt-metabot-user-js/issues
// DISABLED 2026-05-25: @updateURL/@downloadURL pointed to upstream and TM
// auto-update kept overwriting our custom AI + T1-T6 fixes with v230106.
// Re-enable only after forking the repo and pointing to your own raw.gh URL.
// @icon         https://raw.githubusercontent.com/asrdri/yt-metabot-user-js/master/logo.png
// @match        *://*.youtube.com/*
// @include      https://*youtube.com/*
// @require      http://localhost:8888/trustedtypes-shim.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js
// @connect      youtube.com
// @connect      returnyoutubedislikeapi.com
// @connect      raw.githubusercontent.com
// @connect      github.com
// @connect      githubusercontent.com
// @connect      api.deepseek.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @run-at       document-end
// ==/UserScript==

/* global GM_config, GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_info, $, jQuery, indexedDB, IDBKeyRange, MutationObserver, XMLHttpRequest, trustedTypes */

// Trusted Types policy shim — YouTube (and other Google sites) require all
// innerHTML assignments to go through a TrustedHTML policy. jQuery 2.x and
// many parts of MetaBot use raw .innerHTML/.html() which the browser rejects
// with "This document requires 'TrustedHTML' assignment".
// Creating a default policy that passes input through restores legacy behavior.
if (window.trustedTypes && window.trustedTypes.createPolicy && !window.trustedTypes.defaultPolicy) {
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: (input) => input,
      createScript: (input) => input,
      createScriptURL: (input) => input
    });
  } catch (e) { /* policy already exists or CSP blocks — non-fatal */ }
}

GM_config.init( {
  'id': 'ytmetabot_config',
  'title': 'MetaBot/YT Settings',
  'fields': {
    'option1': {
      'label': 'Processing mode for comments by known bots',
      'type': 'int',
      'min': 1,
      'max': 2,
      'default': 1
    },
    'option2': {
      'label': 'Auto-dislike comments by known bots',
      'type': 'checkbox',
      'default': false
    },
    'option3': {
      'label': 'Hide long like/dislike/share button text',
      'type': 'checkbox',
      'default': true
    },
    'option4': {
      'label': 'Use additional lists',
      'type': 'checkbox',
      'default': true
    },
    'option5': {
      'label': 'Send alert to server',
      'type': 'checkbox',
      'default': false
    },
    'listp1': {
      'label': 'Bookmarks (personal list)',
      'type': 'text',
      'default': ''
    },
    'listc1': {
      'label': 'Custom list URL 1',
      'type': 'text',
      'default': 'https://github.com/asrdri/yt-metabot-user-js/raw/master/list-sample.txt'
    },
    'listc2': {
      'label': 'Custom list URL 2',
      'type': 'text',
      'default': ''
    },
    'listc3': {
      'label': 'Custom list URL 3',
      'type': 'text',
      'default': ''
    },
    'listc4': {
      'label': 'Custom list URL 4',
      'type': 'text',
      'default': ''
    },
    'listc5': {
      'label': 'Custom list URL 5',
      'type': 'text',
      'default': ''
    },
    'colorp1': {
      'label': 'Personal color',
      'type': 'int',
      'default': '33023'
    },
    'colorc1': {
      'label': 'Custom color 1',
      'type': 'int',
      'default': '8388863'
    },
    'colorc2': {
      'label': 'Custom color 2',
      'type': 'int',
      'default': '16744448'
    },
    'colorc3': {
      'label': 'Custom color 3',
      'type': 'int',
      'default': '8421504'
    },
    'colorc4': {
      'label': 'Custom color 4',
      'type': 'int',
      'default': '8453888'
    },
    'colorc5': {
      'label': 'Custom color 5',
      'type': 'int',
      'default': '51328'
    },
    'deepseek_api_key': {
      'label': 'DeepSeek API Key',
      'type': 'text',
      'default': ''
    },
    'mb_batch_interval_min': {
      'label': 'Batch interval (min)',
      'type': 'int',
      'min': 5,
      'max': 1440,
      'default': 30
    },
    'mb_daily_batch_cap': {
      'label': 'Daily batch cap',
      'type': 'int',
      'min': 1,
      'max': 500,
      'default': 50
    },
    'mb_auto_classify': {
      'label': 'Auto-classify new channels',
      'type': 'checkbox',
      'default': false
    },
    'mb_total_input_tokens': {
      'label': 'Total input tokens used',
      'type': 'info'
    },
    'mb_total_output_tokens': {
      'label': 'Total output tokens used',
      'type': 'info'
    }
  },
});

const checkb = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAPCAMAAADXs89aAAAA+VBMVEUAAAD///+qqqp/f39mZmZubm5vb29sbGxtbW1tbW1tbW1ubm5ubm5tbW1ubm5tbW1ubm5ubm5ubm5tbW1tbW1ubm5ubm5tbW1ubm5ubm5tbW1ubm5ubm5vb29wcHBxcXFzc3N0dHR1dXV3d3d4eHh6enp7e3t8fHyAgICCgoKFhYWMjIyOjo6Pj4+QkJCSkpKUlJSWlpaZmZmampqdnZ2hoaGqqqqwsLC0tLS1tbW2tra5ubm+vr7ExMTKysrLy8vQ0NDR0dHS0tLU1NTV1dXW1tbe3t7i4uLj4+Pk5OTl5eXn5+fo6Ojq6urs7Ozu7u7w8PD9/f3////SCMufAAAAHHRSTlMAAAMEBSUnKCpbXV9htre6u87Q0dPp6uvs7u/8pkhKVQAAAMdJREFUeNpN0NdWwlAUANEbgvTeQhnQIE1B1ChYQcEC0gL+/8ewzPWwmMf9OMowDKWUP5YqU0pGTaXTHMqdOcM7G7LBIw4Vnc3b89i9BytwYH+uv7oAOqsbyJjCMb4d/urOgYhwqr55wmvdhIRwufXT0zzrgCVM1X2tA5xva1ARLvE4aQCMXoCCcJLaZNpvX71/3QJx4ShUBx+Lz4fp7hrCwmYWL3v5u7XTPmEVtLRfuk7+5OhJIKP9NO2psDIjCatSiId9/7oHY28awgWqV+8AAAAASUVORK5CYII=';
const minf = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAMAAAAMCGV4AAAAM1BMVEUAAAB/f39vb29sbGxtbW1ubm5ubm5sbGxubm5ubm7////Pz8+Li4uampp8fHzb29uSkpKUSDd+AAAACXRSTlMABCcoXbfQ6/zS5clrAAAAYUlEQVQIHQXBAQLCMAgEsBxs+v/32oJJkE5lZ+8Suhu4Z7R6m2c/NVW28zbmew8xeV4A+FWgkjSkCuYDqAo4gNQCgK0BAFMLHsD2pqjL1rqnSSysOdt2U8C9I0insrN3+QOBPC04AhR0BwAAAABJRU5ErkJggg==';
const mred = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAMAAAAMCGV4AAAApVBMVEUzMzP/MzP+MzP+MzP+MzP+MzP9MzP+NTP+NTP/XDP+NTP+NTP+MzP+MzP+NDP+NDP+PTP9NDP+OTP9MzP+NTP+NTP+MzP5MzP/MzP/////e3v/NTP/PT3/Tk7/YWH/UVH/TU3/9/f/+fn/cnL/5eX/QED/ZGT/09P/1tb/wcH/xcX/6Oj/Z2f/hYX/aWn/b2//39//cXH/dXX/oqL/paX/T0//dnb54rKOAAAAGHRSTlMABFzrJurQ1O4Fu+8nt7nQKv1ht17tzyc2HRLDAAAAj0lEQVQIHQXABVIDARAEwLmLuwK9SXB35/9Po5JktB5P9sP5tkmSZDlwsdvtfi2mSbI84rqqvuh1k9EAZ1V1h36TNZxW1Tm0GcOhqm5hlgm4rCvQyR7c1DNYZQju6wF0MgeP9QQ22YKX1zfQplnA+8cnHDfJtIfv+kGvmyQnfQ5/B/rdJEmadtZZdTZtk+QfVeIRvDroEMEAAAAASUVORK5CYII=';
const imgdm = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAACfFBMVEUAAAD+wgD+wQD+wQD/qgD/vwD1ugD+wQD/vwD+wQD+wQD+wgD+wgD5vwD+xwD9wAD7vwD5vQD+wQD1uwD/zADyuAD0uQDyuADytwDzuADxtwDztwDytwDwuAD+wgDzuAD+wgDyuQD+wgD1ugDxtwD0tgBaanv+wgBEW5H+wAD+wQDytwDxtgBIXpL+wQBPZZb+wgD+wQBmeKP+wgBXa5r//wD+wQBic5ldcZ9ccJ5SZ5dEW5H+wgD+wgBlcHD+wAD+wQBEXZD+wQD3vADzuAB0dGltfaZKX5T+xAD6vgDfnwBGXJFVaZpfcp5EWpD/wgDyuAD+wQD19fVuf7OOeiHyugT7vwD+wgCykRY8RTno6OiGgF1oeq7ksQinsc3nswf7vwHyuwr8wQL9wQD2zEf068/18OP03pj20mGBgnjv7++oscV9e2dpe6/CmxL11nf18uv11nb9wAByaCn2uwCrjBj8wADl5uZqd5J+fGiXiE3rtAXj5einsMWZiUrz8/NYaI1SZ5xCSTj8wAH3yDX9wQK0mTpTaJtabqNZbqJUaZrh5Orb3OF1aihESjdSZ5r03ZP06cSAjalpcHemiRr6vgD09PTBmhKFf1+0vNTp6enbqwpeWy/YrR7GoizIoyuwlz2dqcM2QTtvgKjKpSmReyD4vgVpdo32zUnxugv3vgb7wAT6wQz1ugD0ugAoOD/6wAn179310FgwPT2ihhvEnBFZWDHl5eb5vQCEfmDR1Nvv8PLr6+uEkrFARzi4lBW3lBWMgljS1+Ht7e2VoLs/RziSfCC6wdivjxdHTDbN0t7n6e34vQLutwV/cCb4vQD10V318ef2yTv0uQDkLrBbAAAAT3RSTlMATOr6AwQ4shjgmfhtLBf5/vJjNQWgSfyz2PuA8CT3wOdUvsaHMR9+ZCn+jDi3t9Au+fR22AKW7+XlyjiC+zJB0Typ+MPO9xgaMwg61+5oF3I9zwAAAY1JREFUeAFtzfObG1EUxvETu7Zt2zb63snERVMbTZPatm3b7tr2/kN7JzO7d7PPfn79Pue8pLE6LbamzZr37NWbEjSxO6DyfenakgSdHkJ5h45G0rQwoL7brLVJuxBB9Y8NVDf0aCjatg1xdmD7Q8B/qwRAzAt4YxHWvhWR1QFcLgOWf10J4EQACFxBlHUncgK4+/PX7z+PwL1OS8/IzYOPtSOygCsofLG7FFzYEwx6wpBYJxPZ0Jhq1pm6QPjwftVqxH1mg8ggwqtjx6/e3KrYf+CgmbpBI+1ZukyWVxQrDh0+4qIeiPv47tr1G9tkOd+tuPN3Xx/qC27N2nXrN2zcpBVu85Z+1H8AENmxc9cnCf9FOZo0mGgIpIrKKgkQhds7lGjY8G/ff/jB3ePlvlYejCCikSdPnYbizNlz5y9cVL9dGsXL6DFQ+R8/efrsuTv0cuy48RMmEmecNBm13rxNTkmdQnWmToNGyszKzplOgkk3Qw9IvpmzZheF5sylBMZ5882uBbRw0eIlpKgB/8u5fuwF0eAAAAAASUVORK5CYII=';
const imgdma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAABsFBMVEUAAAD+wQD+wgD/qgD+wQD/vwD+wQD+wgD+wgD+wQD+xwBatlz/vwD+wQBft1n+wQDxtwD1ugD9wADyuAD0uQD/zAD7vwD5vQDxtwDzuADyuQDztwDyuADytwDytwDytwDwuAD+wgD0tgCstyvzuAD1uwD+wgD+wgD+wgD+wAD+wQD+wQD+wgD+wQD+wgD//wD+wQD+wgD+wgD+wAD+wQD+wQD+xACtvC1Ztl3/wgD///97uEnyuAD+wQCBu1CWujp7xX32uwCOeiGrjBiykRabx2qc1J5nvWryugRat108RTn7vwH7vwD+wgD9wADxwAb4vQB/cCaSfCAoOD95tkmGt0CihhteWy+ReyDBmhIwPT1HTDb8wAB6t0n6vgD7wAT2zUn03ZP06cR4wXQ2QTv9wQD2zEf068/18OP03pj20mF5ulhyaCnutwX11nf18uv11nb6wQzbqwr10V318ef2yTvksQjCmxI/Rzj6wAn179310FimiRr8wAH3yDX9wQKV0ZdZWDFARzj0uQD5vQDnswdCSTi4lBVESjeKukCvjxe3lBV1aij0ugD4vQLEnBHgcTooAAAAOXRSTlMA6kwD+gTgbfiyF+gYmd5jh8b5/EkF/vL72FSAoLOM8CT3MVjANee+fin+ty75dgKWgvtB0akaVEpkodaYAAABOUlEQVR4XnXPVXMiURCG4SYES4C4u7uvfSO4S9zd3d3d1/5yOAWEGYq8N33xVFdXUyS9RqfOzM3LSK8kWSkGLcIF/lbXSCBJgVi9+UXKKKQlQ9q0UKyKbMgBeBRKwzcUiM+alc3EAJzsA8HLfwDsHsBj7xYKcoj0WuBPH3A88ATg2QE4XmEVCok0AMbGh//fjQDA6P3L79N+BIQSIh0AvE8sbm4x8dt8PpsfolCmIjUS9SCUU0UMesx8KKfTxPODQ1UkecbsZXGchQ0j1UZBnJySipfqwjAzOze/IJd6BkvLK6tr6xtyaWgEurd3dvdE8HKhJogHh0ciACcnyUXU3HJ2fhFEAqHWq+sbsEwWFsfdsuEOSVs7wsXfIVJ2dCYUVte3r4RUSd8VeJNKKn2m/PHTyMTlcjP49QE0u4VtSVu7kQAAAABJRU5ErkJggg==';
const imgdmd = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAAZCAMAAACM5megAAAAllBMVEUAAAB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAx6H3iAAAAMXRSTlMABAgMFBgcICQoLDA8QERITFBUWGBkaGx4fICDj5OXo6evs7e7v8PH09ff4+fr8/f7vr5GKgAAAN1JREFUGBl9wY1agjAABdAbIoSCWiIJLn8yLKNN7vu/XBvQJ87JOegZLfJDaew3U7ilklcfAW5EiTb7JGtRGFtq8hV9BTsntH5orNH3VrNx9mB4kkYdo29xoUPlAwgCtIKaLgJAqkI0BJ0qABEFGme6xQBUCXhhOOUDuycI7jCRHCAlmSDnsEsGrDjgmL6MAYxOfGyGTiwquikPV0s6bdF3oIMao+9Z8d4Gt5KadxJYMt7xYclok7AJar+KRvVFrYTtSC1Ca07tHbZvkhU6KbUlbPOiyCfo+OuiWOHfHxHEYF/PvYVrAAAAAElFTkSuQmCC';
const imgyto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAACJVBMVEX///+qAADMMzP/MzPjKiXbJiPVIyPZJSPFGx/QIiLBGB7cKSXRIiLeKSnkKyfOICHcIiLRISLJHB7jKybCGB/QISHVKSDgKifMGRnhKyXMHR/CGR3ZJSPiLCbdKSXiKybFFyLCGR7WJCLdJyTDGB3JHSDhKiXIHB/ZJiPMHiHQIiLXIyPTIyLKHR/FGCDFGh/lMxnjKyXDGR3GGx/cJyTEGR7BGh7NICDUIiLOHiPcLiLiKyXgKSXhKyXPHyHXJSPNICDgKibgKSbJHB/XJCPnLiLfKSXfKSTfKSbDGR7EGR7KHB/CGR3CGB3CGB7BGB7BGB3BGR3////NHyHLHiDo4ODWJCPMHiD//v7p4eHaJyTZJiTYJiTOICHXJSPYJSPPICHeKSXQISHVJCPunZzFGh/UIyPqmpvnzMv89PTlxMTYUVL78vL08fHomZrzzM399/f+/Pzm09PXTk7QNDbfKiXGGx/pmprnj47XSUvktrbompryxMXVOTncKCXKHSDHHB/t5+f7+vrdKCXbJyTsnJvcOTfhgYDIHB/18fHqm5v05eXaMzHZVFTYTEvHGx/++vrZLy3spKThiYnTLi78+vrs19fqnJzYKynVNDXjrq7VPT7rm5vJHSDebm3XKCbRISLZWFrTIyLSIiLtrKzEGh7cZmXWJiXgKibvtLTWQ0Tlvr7bXVzfd3bwvL3sm5vjW1nTIiLDGh7hKybtnJviKybCGR58TkH5AAAAUnRSTlMAAwUFie17+rn8r7n8HzqvFu9b73vWH1sK54nnida5/BaYr1uJ7fqal+cWOu/6H5oKr/q5mls6H9Y6Fnzte3vnfJeYmOcW7Zqa7e2Y1u/8/O/WqnF1KAAAAb9JREFUeF6FzGOb61AYheGV1B3btu05tLHbsY1j27Zt2/h9k7SnyZt0p7m/ruda0BAi59VkxGVlxWXUtEUKMBJhTflLpFgjwNO6qPC3TuHiZQiStPwDR3sStCwr9hpYaQFRnTliKLOa/IWNhBCmftafDqk+0OUdM5EHn2jbGRO2aMiKexU/zvVyFUOS6OhTjG85cKWPw5EIIL1fNc7Y5fM3+4OlA8KCIdUfxtjde18fDOktFVA2SEih5OL0s+eDOmWwdxJnmc+pk7Pv3ndq2JE7Rsih/7Tn85cxKhfNk8R3qQmcdhy6SpZmlL8injDV1p6OR9eUpRyun4Qc0tNduwOLC+GviUuMmrl9R1nCEfOCoOGO+w/JEoOEUWJKyW7cOjpKJSBqmNjP/Ha+eTysFYX5A4Q/7P74aUBvIVo8hBx2fzvoCdYCoYSEhxk7stnDUSIAqV2qbdtfdnGlAmiq8Cr2ePkqmiBZctzUGshKC56aKCiFT+wFE7H4r+hESEUIEOuuh1AnQpHs3GfImQxCrJowUCVCq2HVW47VDQiSnVP7S6c2Jxs8lflp/4i0/EoYERrj3WvXrd+wcZM7vlEANQfRAClqAtKfNQAAAABJRU5ErkJggg==';
const regexalt = /\{(.*?)\}/;
const regexdate = /joinedDateText"?:\s*\{"content":"(.*?)"/;
const regexdateOld = /joinedDateText(.*?)ext":"(.*?)ext":"(.*?)"}/;
const regexlang = /"hostLanguage":"(.*?)"/;
const regexannyto = /(.*)(\r\n|\n\r|\n)([\W\w]+)/;
const ERKYurl = 'https://raw.githubusercontent.com/FeignedAccomplice/YOUTUBOTS/master/KB.CSV';
const annYTOurl = 'https://raw.githubusercontent.com/FeignedAccomplice/YOUTUBOTS/master/announcements.TXT';
const minDCTime = 36*61;
const maxDCTime = 71*58;
const reporturl = 'tg://resolve?domain=observers_chat';
var annYTOtxt = [];
var arrayERKY = [];
// T19 OPT-2: O(1) Set index for ERKY lookups (arrayERKY.indexOf = O(N) on 6000 entries → 0ms)
// Rebuilt each time filllist populates arrayERKY. Use arrayERKYSet.has(id) instead of indexOf.
var arrayERKYSet = new Set();
var arrayListP1 = [];
var arrayListC1 = [];
var arrayListC2 = [];
var arrayListC3 = [];
var orderedClicksArray = [];
var bDTaskSet = 0;
var bDBlur = 0;
var ytmode = 0;
var listqueue = 0;
var descc1 = '';
var descc2 = '';
var descc3 = '';
var descc4 = '';
var descc5 = '';
var iconsdef = ["\uD83D\uDCCC", "\uD83D\uDD32", "\uD83D\uDD34", "\uD83D\uDD3B", "\uD83D\uDD3A", "\uD83D\uDD37"];
const iconstyledef = 'font-family: Segoe UI Symbol; line-height: 1em;';
const iconp1 = '<span style="' + iconstyledef + '">' + iconsdef[0] + '</span> ';
const iconc1 = '<span style="' + iconstyledef + '">' + iconsdef[1] + '</span> ';
const iconc2 = '<span style="' + iconstyledef + '">' + iconsdef[2] + '</span> ';
const iconc3 = '<span style="' + iconstyledef + '">' + iconsdef[3] + '</span> ';
const iconc4 = '<span style="' + iconstyledef + '">' + iconsdef[4] + '</span> ';
const iconc5 = '<span style="' + iconstyledef + '">' + iconsdef[5] + '</span> ';
var txtlistpadd = '\u2003<span id="listpadd" style="cursor: pointer; ' + iconstyledef + '" title="\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u0437\u0430\u043A\u043B\u0430\u0434\u043A\u0438">' + iconsdef[0] + '</span>';

// ===== AI-augmented bot detection module =====
var mbdb = {};

// T19 OPT-1: IDB write-batch buffer — collect addComment + upsertChannel calls,
// flush them all in a single transaction after 400ms idle.
// Reduces IDB tx count from ~49/page-load to ~3-4, saving ~200ms on initial scroll.
var _mbIdbBatch = {
  _commentQueue: [],      // pending addComment records
  _upsertQueue: {},       // pending upsertChannel by channelId (last write wins)
  _flushTimer: null,
  _FLUSH_DELAY: 400,      // ms — flush after 400ms silence

  scheduleFlush: function() {
    if (_mbIdbBatch._flushTimer) return;
    _mbIdbBatch._flushTimer = setTimeout(_mbIdbBatch.flush, _mbIdbBatch._FLUSH_DELAY);
  },

  // Queue a comment for deferred write
  queueComment: function(commentData) {
    _mbIdbBatch._commentQueue.push(commentData);
    _mbIdbBatch.scheduleFlush();
  },

  // Queue a channel upsert for deferred write (last write for same channelId wins)
  queueUpsert: function(channelData) {
    var id = channelData.channelId;
    var existing = _mbIdbBatch._upsertQueue[id];
    // Merge: existing fields + new fields (new wins on conflict)
    _mbIdbBatch._upsertQueue[id] = existing ? Object.assign({}, existing, channelData) : channelData;
    _mbIdbBatch.scheduleFlush();
  },

  flush: function() {
    _mbIdbBatch._flushTimer = null;
    var comments = _mbIdbBatch._commentQueue.splice(0);
    var upserts = _mbIdbBatch._upsertQueue;
    _mbIdbBatch._upsertQueue = {};
    var upsertList = Object.values(upserts);
    if (comments.length === 0 && upsertList.length === 0) return;
    mbdb.getDb().then(function(db) {
      // Batch comments
      if (comments.length > 0) {
        _mbIdbBatch._flushComments(db, comments);
      }
      // Batch upserts
      if (upsertList.length > 0) {
        _mbIdbBatch._flushUpserts(db, upsertList);
      }
    }).catch(function(e) { console.warn('[MetaBot Batch] flush getDb failed:', e.message); });
  },

  _flushComments: function(db, comments) {
    // Group comments by channelId, check counts per channel in one pass
    var byChannel = {};
    comments.forEach(function(c) {
      if (!byChannel[c.channelId]) byChannel[c.channelId] = [];
      byChannel[c.channelId].push(c);
    });
    var tx = db.transaction('comments', 'readwrite');
    var store = tx.objectStore('comments');
    var idx = store.index('by_channel');
    Object.keys(byChannel).forEach(function(chId) {
      var batch = byChannel[chId];
      var countReq = idx.count(chId);
      countReq.onsuccess = function() {
        var current = countReq.result;
        var toAdd = batch;
        // If over cap: evict one, add one (keep at most 50)
        if (current >= 50) {
          // Only add the last comment from this batch (most recent)
          toAdd = [batch[batch.length - 1]];
          var cursorReq = idx.openCursor(chId);
          cursorReq.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              toAdd.forEach(function(c) { store.add(c); });
            }
          };
        } else {
          // Add all new comments respecting cap
          var remaining = 50 - current;
          toAdd.slice(0, remaining).forEach(function(c) { store.add(c); });
        }
      };
    });
    tx.onerror = function(e) { console.warn('[MetaBot Batch] comment flush tx error:', e.target.error); };
  },

  _flushUpserts: function(db, upsertList) {
    var tx = db.transaction('channels', 'readwrite');
    var store = tx.objectStore('channels');
    upsertList.forEach(function(channelData) {
      var getReq = store.get(channelData.channelId);
      getReq.onsuccess = function() {
        var existing = getReq.result || {};
        var merged = Object.assign({}, existing, channelData, {lastSeen: Date.now()});
        store.put(merged);
      };
    });
    tx.onerror = function(e) { console.warn('[MetaBot Batch] upsert flush tx error:', e.target.error); };
  }
};

mbdb.open = function() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('metabot_db', 3);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('channels')) {
        db.createObjectStore('channels', {keyPath: 'channelId'});
      }
      if (!db.objectStoreNames.contains('comments')) {
        var cs = db.createObjectStore('comments', {autoIncrement: true});
        cs.createIndex('by_channel', 'channelId', {unique: false});
      }
      if (!db.objectStoreNames.contains('clf_queue')) {
        db.createObjectStore('clf_queue', {keyPath: 'channelId'});
      }
      if (!db.objectStoreNames.contains('tracked_channels')) {
        db.createObjectStore('tracked_channels', {keyPath: 'channelId'});
      }
      if (!db.objectStoreNames.contains('networks')) {
        db.createObjectStore('networks', {keyPath: 'clusterId'});
      }
      if (!db.objectStoreNames.contains('analysis_queue')) {
        db.createObjectStore('analysis_queue', {keyPath: 'channelId'});
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function(e) { reject(e.target.error); };
  });
};

mbdb.getDb = function() {
  if (!mbdb._dbPromise) mbdb._dbPromise = mbdb.open();
  return mbdb._dbPromise;
};

mbdb.upsertChannel = function(channelData) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('channels', 'readwrite');
      var store = tx.objectStore('channels');
      var getReq = store.get(channelData.channelId);
      getReq.onsuccess = function() {
        var existing = getReq.result || {};
        var merged = Object.assign({}, existing, channelData, {lastSeen: Date.now()});
        store.put(merged);
      };
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.addComment = function(commentData) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('comments', 'readwrite');
      var store = tx.objectStore('comments');
      var idx = store.index('by_channel');
      var countReq = idx.count(commentData.channelId);
      countReq.onsuccess = function() {
        if (countReq.result >= 50) {
          var cursorReq = idx.openCursor(commentData.channelId);
          cursorReq.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              store.add(commentData);
            }
          };
        } else {
          store.add(commentData);
        }
      };
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.getChannel = function(channelId) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('channels', 'readonly');
      var req = tx.objectStore('channels').get(channelId);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.getComments = function(channelId, limit) {
  limit = limit || 5;
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('comments', 'readonly');
      var req = tx.objectStore('comments').index('by_channel').openCursor(IDBKeyRange.only(channelId), 'prev');
      var results = [];
      req.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.enqueueForClassification = function(channelId) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('clf_queue', 'readwrite');
      var req = tx.objectStore('clf_queue').put({channelId: channelId, addedAt: Date.now(), attempts: 0});
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.dequeueBatch = function(n) {
  n = n || 20;
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('clf_queue', 'readwrite');
      var store = tx.objectStore('clf_queue');
      var req = store.openCursor();
      var batch = [];
      req.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor && batch.length < n) {
          batch.push(cursor.value);
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve(batch);
        }
      };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.applyClassification = function(channelId, label, confidence, reasoning) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(['channels', 'analysis_queue'], 'readwrite');
      var store = tx.objectStore('channels');
      var aqStore = tx.objectStore('analysis_queue');
      var getReq = store.get(channelId);
      getReq.onsuccess = function() {
        var data = getReq.result || {channelId: channelId};
        data.label = label;
        data.confidence = confidence;
        data.reasoning = reasoning;
        data.heuristic_label = null;
        data.classifiedAt = Date.now();
        data.lastSeen = Date.now();
        store.put(data);
        // Auto-enqueue for pattern analysis if non-HUMAN (and not UNKNOWN)
        if (label && label !== 'HUMAN' && label !== 'UNKNOWN') {
          aqStore.put({ channelId: channelId, addedAt: Date.now(), attempts: 0 });
        }
      };
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

// ===== T12 — Channel tracking functions =====
mbdb.trackChannel = function(channelId, displayName) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('tracked_channels', 'readwrite');
      tx.objectStore('tracked_channels').put({channelId: channelId, displayName: displayName || channelId, addedAt: Date.now()});
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.untrackChannel = function(channelId) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('tracked_channels', 'readwrite');
      tx.objectStore('tracked_channels').delete(channelId);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.isTracked = function(channelId) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('tracked_channels', 'readonly').objectStore('tracked_channels').get(channelId);
      req.onsuccess = function() { resolve(!!req.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.getTrackedChannels = function() {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('tracked_channels', 'readonly').objectStore('tracked_channels').getAll();
      req.onsuccess = function() { resolve(req.result || []); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.countChannels = function() {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('channels', 'readonly').objectStore('channels').count();
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.countComments = function() {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('comments', 'readonly').objectStore('comments').count();
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.countQueue = function() {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('clf_queue', 'readonly').objectStore('clf_queue').count();
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.countTracked = function() {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('tracked_channels', 'readonly').objectStore('tracked_channels').count();
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.getAllChannels = function() {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('channels', 'readonly').objectStore('channels').getAll();
      req.onsuccess = function() { resolve(req.result || []); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

// ===== T13 — Analysis queue & network functions =====
mbdb.enqueueForAnalysis = function(channelId) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('analysis_queue', 'readwrite');
      tx.objectStore('analysis_queue').put({channelId: channelId, addedAt: Date.now(), attempts: 0});
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.dequeueAnalysisBatch = function(n) {
  n = n || 20;
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('analysis_queue', 'readwrite');
      var store = tx.objectStore('analysis_queue');
      var req = store.openCursor();
      var batch = [];
      req.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor && batch.length < n) {
          batch.push(cursor.value);
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve(batch);
        }
      };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.applyPatterns = function(channelId, patternsObj) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('channels', 'readwrite');
      var store = tx.objectStore('channels');
      var getReq = store.get(channelId);
      getReq.onsuccess = function() {
        var data = getReq.result || {channelId: channelId};
        if (patternsObj.themes) data.themes = patternsObj.themes;
        if (patternsObj.targets) data.targets = patternsObj.targets;
        if (patternsObj.network_signals) data.network_signals = patternsObj.network_signals;
        if (patternsObj.analysisSummary) data.analysisSummary = patternsObj.analysisSummary;
        data.aiAnalysisAt = patternsObj.aiAnalysisAt || Date.now();
        data.lastSeen = Date.now();
        store.put(data);
      };
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.upsertNetwork = function(network) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('networks', 'readwrite');
      tx.objectStore('networks').put(network);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.getNetworks = function() {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('networks', 'readonly').objectStore('networks').getAll();
      req.onsuccess = function() { resolve(req.result || []); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.countNetworks = function() {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var req = db.transaction('networks', 'readonly').objectStore('networks').count();
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  });
};

mbdb.setUserLabel = function(channelId, userLabel) {
  return mbdb.getDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('channels', 'readwrite');
      var store = tx.objectStore('channels');
      var getReq = store.get(channelId);
      getReq.onsuccess = function() {
        var ch = getReq.result || { channelId: channelId };
        ch.user_label = userLabel;  // null to clear
        ch.user_label_at = userLabel ? Date.now() : null;
        ch.lastSeen = Date.now();
        store.put(ch);
      };
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
};

// ===== T17 — Local heuristics (RU_BOT_LEXICON + F1-F8) =====
var RU_BOT_LEXICON = [
  /\bинoагент(ы|ах|ами|ов|у)?\b/i,
  /\bпят[ао]я колонна\b/i,
  /\bденацификаци\w+/i,
  /\bколлективн\w+ запад\w*/i,
  /\bпиндос\w+/i,
  /\bнацист\w+ в Киеве/i,
  /\bангл[оа]сакс\w+/i,
  /\bру[сс]?офоб\w+/i,
  /\bлибераст\w+/i,
  /\bпредател\w+ родин\w+/i,
  /\bпрод[аы]лись (запад\w*|америк)/i,
  /\bгрант[оа]ед\w*/i,
  /\bспециальн\w+ военн\w+ операци\w+/i,
  /\bбандеровц\w+/i,
  /\bнав[оа]льнен\w+/i
];

var RU_GENERIC_PATTERNS = [
  /^(молодец[!.,]?\s*)+$/i,
  /^(правильно[!.,]?\s*)+$/i,
  /^(согласен полностью[!.,]?\s*)+$/i,
  /^(100[%!]?\s*)+$/i,
  /^(\+1[!.,]?\s*)+$/i,
  /^(огонь[!.,]?\s*)+$/i,
  /^(топ[!.,]?\s*)+$/i,
  /^([\u{1F600}-\u{1F64F}]+\s*)+$/u
];

var mbHeuristics = {};

mbHeuristics.shannonEntropy = function(str) {
  // T19 OPT-7: Map instead of plain object — avoids prototype chain lookups.
  // Also caps string at 500 chars (entropy converges well before that, saves ~40% on long comments).
  if (!str || str.length === 0) return 0;
  var s = str.length > 500 ? str.slice(0, 500) : str;
  var freq = new Map();
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    freq.set(c, (freq.get(c) || 0) + 1);
  }
  var e = 0;
  var n = s.length;
  freq.forEach(function(count) {
    var p = count / n;
    e -= p * Math.log2(p);
  });
  return e;
};

mbHeuristics.isGeneric = function(text) {
  if (!text) return false;
  var t = text.trim();
  if (t.length < 5) return true;
  for (var i = 0; i < RU_GENERIC_PATTERNS.length; i++) {
    if (RU_GENERIC_PATTERNS[i].test(t)) return true;
  }
  return false;
};

mbHeuristics.hasRuBotLexicon = function(text) {
  if (!text) return 0;
  var count = 0;
  for (var i = 0; i < RU_BOT_LEXICON.length; i++) {
    if (RU_BOT_LEXICON[i].test(text)) count++;
  }
  return count;
};

mbHeuristics.compute = async function(channel, comments) {
  comments = comments || [];
  // Fast path: no data at all — skip full computation
  if (!channel.joinDate && comments.length < 3) {
    return { score: 0, signals: [], dataPoints: 0, verdict: null };
  }
  var signals = [];
  var score = 0;
  var dataPoints = 0; // how many signals fired

  // F1: completeness — ONLY counts if VERY suspicious profile.
  // Регулярный viewer-аккаунт без видео — НЕ бот-сигнал сам по себе.
  // Засчитываем только КОМБО: молодой аккаунт <30 дней + нет подписчиков + нет видео.
  if (channel.joinDate) {
    var ageDays = (Date.now() - new Date(channel.joinDate).getTime()) / 86400000;
    if (ageDays < 30 && (!channel.subscriberCount || channel.subscriberCount === 0) && (!channel.videoCount || channel.videoCount === 0)) {
      signals.push('F1:very_young_empty_account:' + Math.floor(ageDays) + 'd');
      score += 20;
      dataPoints++;
    }
  }

  // F2: generic ratio — only if >=5 comments (нужна большая выборка)
  if (comments.length >= 5) {
    var generic = comments.filter(function(c){ return mbHeuristics.isGeneric(c.text); }).length;
    var ratio = generic / comments.length;
    if (ratio > 0.6) {
      signals.push('F2:high_generic_ratio:' + ratio.toFixed(2));
      score += 25;
      dataPoints++;
    }
  }

  // F3: text entropy — only if >=5 long comments
  if (comments.length >= 5) {
    var longComments = comments.filter(function(c) { return c.text && c.text.length >= 20; });
    if (longComments.length >= 3) {
      var totalEntropy = 0;
      for (var i = 0; i < longComments.length; i++) {
        totalEntropy += mbHeuristics.shannonEntropy(longComments[i].text);
      }
      var avgEntropy = totalEntropy / longComments.length;
      // Very low entropy = templates. Healthy text >3.5. Threshold 2.5 (was 3.0 — too lax)
      if (avgEntropy < 2.5) {
        signals.push('F3:very_low_entropy:' + avgEntropy.toFixed(2));
        score += 20;
        dataPoints++;
      }
    }
  }

  // F4: interval regularity — only if >=5 comments
  if (comments.length >= 5) {
    var sorted = comments.slice().sort(function(a,b){ return a.timestamp - b.timestamp; });
    var intervals = [];
    for (var j = 1; j < sorted.length; j++) {
      intervals.push((sorted[j].timestamp - sorted[j-1].timestamp) / 1000);
    }
    var mean = intervals.reduce(function(s,x){ return s+x; }, 0) / intervals.length;
    var variance = intervals.reduce(function(s,x){ return s + (x-mean)*(x-mean); }, 0) / intervals.length;
    var stdDev = Math.sqrt(variance);
    // Very regular = bot. Tighten: <60s (was 300s) for bot-tier regularity
    if (stdDev < 60) {
      signals.push('F4:robotic_intervals:stddev=' + stdDev.toFixed(0) + 's');
      score += 30;
      dataPoints++;
    }
  }

  // F7: username — ONLY very specific bot patterns
  if (channel.handle || channel.channelId) {
    var u = (channel.handle || '').replace(/^@/, '');
    if (u && /^[a-zA-Z]+\d{6,}$/.test(u)) {
      // EnglishWord followed by 6+ digits — typical bot generation
      signals.push('F7:auto_generated_handle');
      score += 15;
      dataPoints++;
    }
  }

  // F8: subs/video ratio — skip (too many edge cases, not a strong signal)

  // RU lexicon — STRONG signal. Hits >=3 raises significantly.
  // Single hit could be quote/discussion — недостаточно.
  if (comments.length > 0) {
    var lexHits = 0;
    for (var k = 0; k < comments.length; k++) {
      lexHits += mbHeuristics.hasRuBotLexicon(comments[k].text);
    }
    if (lexHits >= 3) {
      signals.push('RU:strong_bot_lexicon:' + lexHits + '_hits');
      score += 35;
      dataPoints++;
    } else if (lexHits === 2) {
      signals.push('RU:weak_bot_lexicon:' + lexHits + '_hits');
      score += 15;
      dataPoints++;
    }
    // 1 hit — ignored (could be just quoting)
  }

  // Aggregate verdict — CONSERVATIVE:
  // - BOT_HEURISTIC требует score >= 80 AND ≥2 different signals
  // - SUSPECT_HEURISTIC требует score >= 40 AND ≥2 signals
  // - HUMAN_HEURISTIC: только если есть данные (>=10 комментов) И nothing подозрительно
  // - В остальных случаях — null (нужен AI или просто UNKNOWN)

  var verdict = null;
  if (score >= 80 && dataPoints >= 2) {
    verdict = 'BOT_HEURISTIC';
  } else if (score >= 40 && dataPoints >= 2) {
    verdict = 'SUSPECT_HEURISTIC';
  } else if (comments.length >= 10 && score === 0) {
    // Достаточно данных + ноль сигналов = уверенно HUMAN
    verdict = 'HUMAN_HEURISTIC';
  }
  // Otherwise — null (нужен AI или просто UNKNOWN badge)

  return {
    score: score,
    signals: signals,
    dataPoints: dataPoints,
    verdict: verdict
  };
};

// ===== T14 — UI helpers =====
async function refreshStats() {
  try {
    var chCount = await mbdb.countChannels();
    var qCount = await mbdb.countQueue();
    var cmCount = await mbdb.countComments();
    var nCount = await mbdb.countNetworks();
    var el = document.querySelector('#mbStats');
    if (el) el.textContent = '\u041A\u0430\u043D\u0430\u043B\u043E\u0432: ' + chCount + ' \u00B7 \u041E\u0447\u0435\u0440\u0435\u0434\u044C: ' + qCount + ' \u00B7 \u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432: ' + cmCount + ' \u00B7 \u0421\u0435\u0442\u043E\u043A: ' + nCount;
  } catch (e) { console.warn('[MetaBot] refreshStats failed:', e.message); }
}

function showToast(msg) {
  var el = document.querySelector('#configsaved');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 1500);
}

async function renderTracked() {
  try {
    var list = await mbdb.getTrackedChannels();
    var countEl = document.querySelector('#mbTrackedCount');
    if (countEl) countEl.textContent = list.length ? '(' + list.length + ')' : '';
    var ul = document.querySelector('#mbTrackedList');
    if (!ul) return;
    if (list.length === 0) {
      ul.innerHTML = '<div style=\"color:#666;font-style:italic;padding:8px;text-align:center\">\u041D\u0435\u0442 \u043E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0445 \u043A\u0430\u043D\u0430\u043B\u043E\u0432.<br>\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u0438\u0434\u0435\u043E \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 [\uD83D\uDC41 \u041E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0442\u044C] \u043F\u043E\u0434 \u0430\u0432\u0442\u043E\u0440\u043E\u043C.</div>';
      return;
    }
    ul.innerHTML = list.map(function(c) {
      return '<div class=\"mb-tracked-item\"><span>' + (c.displayName || c.channelId) + '</span><span class=\"mb-remove\" data-id=\"' + c.channelId + '\">\u2715</span></div>';
    }).join('');
    ul.querySelectorAll('.mb-remove').forEach(function(el) {
      el.onclick = async function() {
        try { await mbdb.untrackChannel(el.dataset.id); renderTracked(); refreshStats(); } catch (e) { console.warn('[MetaBot] untrack failed:', e.message); }
      };
    });
  } catch (e) { console.warn('[MetaBot] renderTracked failed:', e.message); }
}

async function renderNetworks() {
  try {
    var list = await mbdb.getNetworks();
    var countEl = document.querySelector('#mbNetworksCount');
    if (countEl) countEl.textContent = list.length ? '(' + list.length + ')' : '';
    var ul = document.querySelector('#mbNetworksList');
    if (!ul) return;
    if (list.length === 0) {
      ul.innerHTML = '<div style=\"color:#666;font-style:italic;padding:8px;text-align:center\">\u0421\u0435\u0442\u043A\u0438 \u043D\u0435 \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u044B.<br>\u041D\u0430\u0436\u043C\u0438\u0442\u0435 [\uD83D\uDD78 \u041A\u043B\u0430\u0441\u0442\u0435\u0440\u0438\u0437\u043E\u0432\u0430\u0442\u044C] \u043F\u043E\u0441\u043B\u0435 \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u043E\u0432.</div>';
      return;
    }
    ul.innerHTML = list.map(function(n) {
      var color = n.name === 'PRO-KREMLIN' ? '#a44' : (n.name === 'PRO-OPPOSITION' ? '#4a8' : '#888');
      return '<div class=\"mb-network-item\" data-cluster=\"' + n.clusterId + '\">' +
        '<span style=\"font-weight:600;color:' + color + '\">' + n.name + '</span>' +
        '<span style=\"color:#888;margin-left:8px\">' + n.members.length + ' \u043A\u0430\u043D\u0430\u043B\u043E\u0432</span>' +
        '<span style=\"margin-left:auto;font-size:11px;color:#666\">' + new Date(n.detectedAt).toLocaleDateString() + '</span></div>';
    }).join('');
  } catch (e) { console.warn('[MetaBot] renderNetworks failed:', e.message); }
}

// ===== T12 — Watch page owner track button =====
async function getCurrentVideoOwnerId() {
  try {
    var el = document.querySelector('ytd-video-owner-renderer #channel-name a, ytd-video-owner-renderer ytd-channel-name a, #owner #channel-name a, #upper-row #channel-name a, #meta #channel-name a, ytd-watch-metadata #owner a, ytd-video-owner-renderer a.yt-simple-endpoint');
    if (!el) return null;
    return await normalizeChannelId(el.href);
  } catch (e) { return null; }
}

async function ensureTrackButton() {
  // Mutex against race conditions: MutationObserver + setTimeout series triggered
  // ensureTrackButton 7+ times in parallel — all got null from querySelector,
  // all created their own button (7 copies on one page).
  if (window._mbCreatingTrackBtn) return;
  window._mbCreatingTrackBtn = true;
  try {
    // Find first link in owner area that actually points to a channel (not javascript:void(0) overlay).
    // Дождь and similar channels render a tooltip-link as the first <a> with javascript:void(0).
    var ownerContainer = document.querySelector(
      'ytd-video-owner-renderer, #owner, #upper-row, #meta, ytd-watch-metadata #owner, #above-the-fold'
    );
    var ownerEl = null;
    if (ownerContainer) {
      var anchors = ownerContainer.querySelectorAll('a[href]');
      for (var ai = 0; ai < anchors.length; ai++) {
        var h = anchors[ai].getAttribute('href') || '';
        if (h && /^(\/channel\/UC|\/@|https?:\/\/(www\.)?youtube\.com\/(channel\/UC|@))/.test(h)) {
          // Exclude anchors that live inside description/infocards sub-renderers
          // (e.g. Дождь: ytd-video-description-infocards-section-renderer has a channel link
          //  but its parent is display:none — it belongs to the expanded description, not owner row)
          var inDescription = anchors[ai].closest(
            'ytd-video-description-infocards-section-renderer, ytd-structured-description-content-renderer, #description, #description-inner'
          );
          if (inDescription) continue;
          ownerEl = anchors[ai];
          break;
        }
      }
    }
    if (!ownerEl) {
      // Fallback 1: meta[itemprop=channelId]
      var meta = document.querySelector('meta[itemprop="channelId"]');
      if (meta && meta.content) {
        ownerEl = { href: 'https://www.youtube.com/channel/' + meta.content, textContent: document.querySelector('meta[itemprop="name"]')?.content || '' };
      }
    }
    if (!ownerEl) {
      // Fallback 2: parse ytInitialData / ytInitialPlayerResponse — needed for Дождь and similar
      // channels that render owner-link as javascript:void(0) overlay tooltip.
      try {
        var html = document.documentElement.outerHTML;
        var m = html.match(/"externalChannelId":"(UC[A-Za-z0-9_-]+)"/);
        var nameM = html.match(/"ownerChannelName":"([^"]+)"/);
        if (m && m[1]) {
          ownerEl = {
            href: 'https://www.youtube.com/channel/' + m[1],
            textContent: nameM ? nameM[1] : m[1]
          };
        }
      } catch (e) {}
    }
    if (!ownerEl) return;
    var ownerId = await normalizeChannelId(ownerEl.href);
    if (!ownerId) return;
    var safeId = 'mbTrackOwnerBtn-' + ownerId.replace(/[^A-Za-z0-9_-]/g,'_');
    // If button for THIS owner already exists in DOM AND is attached to a live node — do nothing (no flicker).
    var current = document.getElementById(safeId);
    if (current && current.isConnected) return;
    // Remove ANY buttons for OTHER channels (stale from previous video).
    document.querySelectorAll('[id^="mbTrackOwnerBtn-"]').forEach(function(e){
      if (e.id !== safeId) e.remove();
    });
    var tracked = await mbdb.isTracked(ownerId);
    var btn = document.createElement('button');
    btn.id = 'mbTrackOwnerBtn-' + ownerId.replace(/[^A-Za-z0-9_-]/g,'_');
    btn.classList.add('mbTrackOwnerBtn');
    btn.style.cssText = 'padding:4px 10px; margin-left:8px; border-radius:12px; border:none; cursor:pointer; font-size:12px; background:' + (tracked ? '#3a5' : '#444') + '; color:#fff;';
    btn.textContent = tracked ? '\uD83D\uDC41 \u041E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u2713' : '\uD83D\uDC41 \u041E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0442\u044C';
    btn.onclick = async function() {
      try {
        var isTracked = await mbdb.isTracked(ownerId);
        if (isTracked) {
          await mbdb.untrackChannel(ownerId);
          btn.style.background = '#444';
          btn.textContent = '\uD83D\uDC41 \u041E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0442\u044C';
        } else {
          var displayNameEl = document.querySelector('ytd-video-owner-renderer #channel-name a, ytd-video-owner-renderer ytd-channel-name a, #owner #channel-name a, #upper-row #channel-name a, #meta #channel-name a, ytd-watch-metadata #owner a, ytd-video-owner-renderer a.yt-simple-endpoint');
          var displayName = displayNameEl ? displayNameEl.textContent.trim() : ownerId;
          await mbdb.trackChannel(ownerId, displayName);
          btn.style.background = '#3a5';
          btn.textContent = '\uD83D\uDC41 \u041E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u2713';
        }
        refreshStats();
        if (typeof renderTracked === 'function') renderTracked();
      } catch (e) { console.warn('[MetaBot] track toggle failed:', e.message); }
    };
    // ownerEl may be a synthetic object (meta fallback) — attach to a VISIBLE container near the owner row.
    // Strategy: walk up from ownerEl to find a container that is actually rendered (offsetParent !== null
    // means it has a rendered ancestor). If closest() yields a hidden container, fall back to the
    // known-visible candidates in priority order.
    var parent = null;
    if (ownerEl.closest) parent = ownerEl.closest('#channel-name, ytd-channel-name, #owner, ytd-video-owner-renderer');
    // Verify the candidate is visible; if not, discard and use known-visible fallbacks
    if (parent && parent.offsetParent === null && parent !== document.body) parent = null;
    if (!parent) {
      // Priority: upload-info row (always visible), then full owner row, then #owner wrapper
      parent = document.querySelector(
        'ytd-video-owner-renderer #upload-info, ytd-video-owner-renderer, #owner'
      );
      // Final visibility check — walk candidates until we find a rendered one
      if (parent && parent.offsetParent === null && parent !== document.body) {
        parent = document.querySelector('ytd-video-owner-renderer') || document.querySelector('#owner');
      }
    }
    if (parent) parent.appendChild(btn);
  } catch (e) { console.warn('[MetaBot] ensureTrackButton failed:', e.message); }
  finally { window._mbCreatingTrackBtn = false; }
}

// Cleanup orphan track buttons on SPA navigation
document.addEventListener('yt-navigate-finish', function() {
  var btns = document.querySelectorAll('[id^="mbTrackOwnerBtn"], .mbTrackOwnerBtn');
  btns.forEach(function(b){ b.remove(); });
});

async function ensureTrackedBadge() {
  try {
    var existing = document.querySelector('#mbTrackedBadge');
    if (existing) existing.remove();
    var ownerId = await getCurrentVideoOwnerId();
    if (!ownerId) return;
    var tracked = await mbdb.isTracked(ownerId);
    if (!tracked) return;
    var badge = document.createElement('span');
    badge.id = 'mbTrackedBadge';
    badge.style.cssText = 'position:fixed;top:60px;right:20px;z-index:9999;background:#3a5;color:#fff;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;';
    badge.textContent = '\uD83D\uDC41 \u041E\u0422\u0421\u041B\u0415\u0416\u0418\u0412\u0410\u0415\u0422\u0421\u042F';
    document.body.appendChild(badge);
  } catch (e) { console.warn('[MetaBot] ensureTrackedBadge failed:', e.message); }
}

// ===== T13 — Pattern analysis prompt =====
var PATTERN_SYSTEM_PROMPT = 'You are a YouTube comment behavior pattern analyst.\nFor each channel, analyze their COMMENT SAMPLES and produce:\n\n1. themes: Object<theme_name, percentage> — what topics they comment on\n   (politics_russia, politics_world, entertainment, music, gaming, education, other)\n   Sum of percentages = 100.\n\n2. targets: Object<person_or_entity, {pro: 0-100, anti: 0-100}>\n   Common: Putin, Navalny, Kac, Soloviev, Pevchikh, Zelensky, RF_government, Opposition, Ukraine, USA, EU\n   Only include targets actually mentioned.\n\n3. network_signals: Object<signal, 0-100>\n   - pro_kremlin_score (pro-Putin/RF gov stance)\n   - anti_opposition_score (anti-Navalny/anti-Kac/anti-opposition)\n   - pro_opposition_score\n   - anti_kremlin_score\n   - whataboutism_score (deflection tactics)\n   - personal_attack_score (ad hominem)\n   - repetition_score (same talking points repeated)\n   - quality_score (0-100, organic engagement vs templated)\n\n4. summary: 1-sentence behavior description in Russian (max 100 chars)\n\nReturn ONLY JSON: {"patterns": [{channelId, themes, targets, network_signals, summary}]}';

async function analyzePatternsBatch() {
  try {
    var queue = await mbdb.dequeueAnalysisBatch(20);
    if (queue.length === 0) { showToast('\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u043F\u0443\u0441\u0442\u0430'); return; }
    var channelData = [];
    for (var i = 0; i < queue.length; i++) {
      var ch = await mbdb.getChannel(queue[i].channelId);
      var comments = await mbdb.getComments(queue[i].channelId, 10);
      channelData.push({
        channelId: queue[i].channelId,
        label: ch ? ch.label : null,
        confidence: ch ? ch.confidence : null,
        joinDate: ch ? ch.joinDate : null,
        commentSamples: comments.map(function(c) {
          return {videoId: c.videoId, text: c.text, timestamp: c.timestamp};
        }).filter(function(c) { return c.text && c.text.length > 5; }).slice(0, 8)
      });
    }
    var response = await callDeepSeek([
      {role: 'system', content: PATTERN_SYSTEM_PROMPT},
      {role: 'user', content: JSON.stringify(channelData)}
    ]);
    var parsed = JSON.parse(response.choices[0].message.content);
    if (parsed.patterns && Array.isArray(parsed.patterns)) {
      for (var j = 0; j < parsed.patterns.length; j++) {
        var p = parsed.patterns[j];
        await mbdb.applyPatterns(p.channelId, {
          themes: p.themes,
          targets: p.targets,
          network_signals: p.network_signals,
          analysisSummary: p.summary,
          aiAnalysisAt: Date.now()
        });
        refreshBadgesForChannel(p.channelId);
      }
    }
    showToast('\u041F\u0440\u043E\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043E: ' + parsed.patterns.length);
    refreshStats();
  } catch (e) {
    console.warn('[MetaBot AI] analyzePatternsBatch failed:', e.message);
    showToast('\u041E\u0448\u0438\u0431\u043A\u0430 \u0430\u043D\u0430\u043B\u0438\u0437\u0430: ' + e.message);
  }
}

async function clusterNetworks() {
  try {
    var channels = await mbdb.getAllChannels();
    var candidates = channels.filter(function(c) { return c.network_signals && c.label !== 'HUMAN'; });
    if (candidates.length < 3) { showToast('Нужно ≥3 каналов с network_signals (BOT/SUSPECT, прошедших \ud83d\udd0d Анализ паттернов)'); return; }
    var signalKeys = ['pro_kremlin_score', 'anti_opposition_score', 'pro_opposition_score', 'anti_kremlin_score', 'whataboutism_score', 'personal_attack_score', 'repetition_score'];
    var vectors = candidates.map(function(c) {
      return {channelId: c.channelId, vec: signalKeys.map(function(k) { return c.network_signals[k] || 0; })};
    });
    var THRESHOLD = 30;
    var parent = {};
    var find = function(x) { return parent[x] === x ? x : (parent[x] = find(parent[x])); };
    var union = function(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    vectors.forEach(function(v) { parent[v.channelId] = v.channelId; });
    for (var i = 0; i < vectors.length; i++) {
      for (var ii = i + 1; ii < vectors.length; ii++) {
        var dist = Math.sqrt(vectors[i].vec.reduce(function(s, x, k) { return s + Math.pow(x - vectors[ii].vec[k], 2); }, 0));
        if (dist < THRESHOLD) union(vectors[i].channelId, vectors[ii].channelId);
      }
    }
    var groups = {};
    vectors.forEach(function(v) {
      var root = find(v.channelId);
      if (!groups[root]) groups[root] = [];
      groups[root].push(v.channelId);
    });
    var createdCount = 0;
    for (var root in groups) {
      var members = groups[root];
      if (members.length < 3) continue;
      var avgSignals = {};
      signalKeys.forEach(function(k) {
        avgSignals[k] = members.reduce(function(s, mid) {
          var c = candidates.find(function(c2) { return c2.channelId === mid; });
          return s + ((c && c.network_signals[k]) || 0);
        }, 0) / members.length;
      });
      var name = 'UNKNOWN';
      if (avgSignals.pro_kremlin_score > 60) name = 'PRO-KREMLIN';
      else if (avgSignals.pro_opposition_score > 60) name = 'PRO-OPPOSITION';
      else if (avgSignals.anti_kremlin_score > 60) name = 'ANTI-KREMLIN';
      else if (avgSignals.anti_opposition_score > 60) name = 'ANTI-OPPOSITION';
      var clusterId = 'cluster_' + Date.now() + '_' + createdCount;
      await mbdb.upsertNetwork({
        clusterId: clusterId,
        name: name,
        description: 'Auto-detected cluster, ' + members.length + ' members, avg pro-K ' + avgSignals.pro_kremlin_score.toFixed(0) + ', anti-opp ' + avgSignals.anti_opposition_score.toFixed(0),
        signature: avgSignals,
        members: members,
        detectedAt: Date.now()
      });
      for (var mi = 0; mi < members.length; mi++) {
        await mbdb.upsertChannel({channelId: members[mi], network_cluster_id: clusterId});
        refreshBadgesForChannel(members[mi]);
      }
      createdCount++;
    }
    showToast('\u0421\u043E\u0437\u0434\u0430\u043D\u043E \u0441\u0435\u0442\u043E\u043A: ' + createdCount);
    refreshStats();
    if (typeof renderNetworks === 'function') renderNetworks();
  } catch (e) {
    console.warn('[MetaBot AI] clusterNetworks failed:', e.message);
    showToast('\u041E\u0448\u0438\u0431\u043A\u0430 \u043A\u043B\u0430\u0441\u0442\u0435\u0440\u0438\u0437\u0430\u0446\u0438\u0438: ' + e.message);
  }
}

console.log("[MetaBot for Youtube] Starting at URL: " + window.location);
if (window.location.pathname == '/live_chat_replay' || window.location.pathname == '/live_chat') {
  console.log("[MetaBot for Youtube] Live Chat page detected. Skipping.");
} else {
  waitforinit();
}

// T12 — Owner [👁 Отслеживать] button bootstrap.
// ensureTrackButton was defined but never invoked. Hook into yt-navigate-finish,
// initial load, and a MutationObserver on body so the button appears on every
// watch page even after SPA navigation.
function _mbBootstrapTrackButton() {
  if (typeof ensureTrackButton !== 'function') return;
  var run = function() {
    if (/\/watch\?/.test(location.href)) {
      ensureTrackButton();
      if (typeof ensureTrackedBadge === 'function') ensureTrackedBadge();
    }
  };
  // initial + delayed retries (YouTube hydrates owner element late)
  setTimeout(run, 1500);
  setTimeout(run, 4000);
  setTimeout(run, 8000);
  // SPA navigation
  document.addEventListener('yt-navigate-finish', function() {
    setTimeout(run, 1500);
    setTimeout(run, 4000);
  });
  // Fallback: MutationObserver — if owner renderer appears later
  try {
    var mo = new MutationObserver(function() {
      if (document.querySelectorAll('.mbTrackOwnerBtn, [id^="mbTrackOwnerBtn"]').length === 0 && document.querySelector('ytd-video-owner-renderer #channel-name a, ytd-video-owner-renderer ytd-channel-name a, #owner #channel-name a, #upper-row #channel-name a, #meta #channel-name a, ytd-watch-metadata #owner a, ytd-video-owner-renderer a.yt-simple-endpoint')) {
        run();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
}
_mbBootstrapTrackButton();

function waitforinit() {
  // Wait for both DOM head AND GM_config to be fully initialized.
  // GM_config.fields is populated by GM_config.init() synchronously, but
  // TM's Proxy wrapper (issue #113) can defer property access — guard for it.
  var gmReady = false;
  try {
    gmReady = typeof GM_config !== 'undefined'
              && GM_config.fields
              && Object.keys(GM_config.fields).length > 0;
  } catch (e) { gmReady = false; }
  if (document.head === null || !gmReady) {
    setTimeout(waitforinit, 100);
  } else {
    init();
  }
}

function init() {
  if (document.head.innerHTML.indexOf('window.ShadyDOM') >= 0) {
    console.log("[MetaBot for Youtube] YouTube New design detected.");
    ytmode = 1;
  } else if (document.head.innerHTML.indexOf('name="viewport"') >= 0) {
    console.log("[MetaBot for Youtube] YouTube Mobile mode detected.");
    ytmode = 3;
  } else if (document.head.innerHTML.indexOf('ytcfg.set("LACT"') >= 0) {
    console.log("[MetaBot for Youtube] YouTube Classic design detected.");
    ytmode = 2;
    txtlistpadd = '\u2003<span id="listpadd" style="cursor: pointer; color: #767676;' + iconstyledef + '" title="Добавить в закладки">' + iconsdef[0] + '</span>';
  } else {
    console.log("[MetaBot for Youtube] Unable to detect YouTube design. Stopping.");
  }
  if (ytmode !== 3) {
    listqueue++;
    getlist(filllist, -1, annYTOurl);
  }
  listqueue++;
  getlist(filllist, 0, ERKYurl);
  if (GM_config.get('option4') === true) {
    arrayListP1 = GM_config.get('listp1').match(/[^\r\n=]+/g);
    if (GM_config.get('listc1') !== '') {
      listqueue++;
      getlist(filllist, 1, GM_config.get('listc1'));
    }
    if (GM_config.get('listc2') !== '') {
      listqueue++;
      getlist(filllist, 2, GM_config.get('listc2'));
    }
    if (GM_config.get('listc3') !== '') {
      listqueue++;
      getlist(filllist, 3, GM_config.get('listc3'));
    }
    if (GM_config.get('listc4') !== '') {
      listqueue++;
      getlist(filllist, 4, GM_config.get('listc4'));
    }
    if (GM_config.get('listc5') !== '') {
      listqueue++;
      getlist(filllist, 5, GM_config.get('listc5'));
    }
  }
  waitforlists();
}

function filllist(numArr, response, code, url) {
  if (code !== 200) {
    console.log("[MetaBot for Youtube] List load error. URL " + url + " Code " + code);
  } else {
    switch (numArr) {
      case -1:
        annYTOtxt = regexannyto.exec(response);
        var dbname = "YTO announcement";
        switch (ytmode) {
          case 1:
            waitForKeyElements('ytd-comments-header-renderer.ytd-item-section-renderer', insertannNew);
            break;
          case 2:
        }
        break;
      case 0:
        arrayERKY = response.match(/[^\r\n=]+/g);
        // T19 OPT-2: rebuild O(1) Set index (IDs are at even indices: 0,2,4,...)
        arrayERKYSet = new Set();
        if (arrayERKY) {
          for (var i = 0; i < arrayERKY.length; i += 2) arrayERKYSet.add(arrayERKY[i]);
        }
        var dbname = "ERKY-db";
        break;
      case 1:
        arrayListC1 = response.match(/[^\r\n=]+/g);
        var dbname = "Custom list #1";
        descc1 = '[' + (arrayListC1.length / 2 - 1) + '] ' + Aparse(arrayListC1[0]) + ': ' + Aparse(arrayListC1[1]) + '<br>\u2003';
        break;
      case 2:
        arrayListC2 = response.match(/[^\r\n=]+/g);
        var dbname = "Custom list #2";
        descc2 = '[' + (arrayListC2.length / 2 - 1) + '] ' + Aparse(arrayListC2[0]) + ': ' + Aparse(arrayListC2[1]) + '<br>\u2003';
        break;
      case 3:
        arrayListC3 = response.match(/[^\r\n=]+/g);
        var dbname = "Custom list #3";
        descc3 = '[' + (arrayListC3.length / 2 - 1) + '] ' + Aparse(arrayListC3[0]) + ': ' + Aparse(arrayListC3[1]) + '<br>\u2003';
        break;
      case 4:
        arrayListC4 = response.match(/[^\r\n=]+/g);
        var dbname = "Custom list #4";
        descc4 = '[' + (arrayListC4.length / 2 - 1) + '] ' + Aparse(arrayListC4[0]) + ': ' + Aparse(arrayListC4[1]) + '<br>\u2003';
        break;
      case 5:
        arrayListC5 = response.match(/[^\r\n=]+/g);
        var dbname = "Custom list #5";
        descc5 = '[' + (arrayListC5.length / 2 - 1) + '] ' + Aparse(arrayListC5[0]) + ': ' + Aparse(arrayListC5[1]) + '<br>\u2003';
    }
    if (code === 200) {
      console.log("[MetaBot for Youtube] " + dbname + " loaded. Code " + code);
    } else {
      console.log("[MetaBot for Youtube] " + dbname + " load error. Code " + code);
    }
  }
  listqueue--;
}

function waitforlists() {
  if (listqueue === 0) {
    switch (ytmode) {
      case 1:
        spinnercheckNew();
        // T4: MutationObserver covers infinite-scroll comment additions on modern YT
        setupCommentObserver();
        // T6: ytd-comment-view-model is primary in modern YT; legacy ytd-comment-renderer kept as fallback
        waitForKeyElements('ytd-comment-view-model, div#main.style-scope.ytd-comment-renderer', parseitemNew);
//        waitForKeyElements('ytd-menu-renderer.style-scope.ytd-video-primary-info-renderer', preparedmNew);
        // T2: primary = modern YT polymer3 header; fallback = legacy c4-tabbed-header
        waitForKeyElements('yt-page-header-renderer, div#channel-header.ytd-c4-tabbed-header-renderer', insertchanNew);
        break;
      case 2:
        console.log("[MetaBot for Youtube] YouTube Classic design not supported.");
        break;
      case 3:
        console.log("[MetaBot for Youtube] YouTube Mobile mode not supported.");
    }
    return;
  } else {
    setTimeout(waitforlists, 500);
  }
}

function spinnercheckNew() {
  waitForKeyElements('paper-spinner-lite.ytd-item-section-renderer[aria-hidden="true"]', function(jNode) {
    if (getURLParameter('v', location.search) === null) {
      return;
    }
    console.log("[MetaBot for Youtube] Comment sorting spinner found.");
    var mutationObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if ($(jNode).find("#spinnerContainer").hasClass("cooldown")) {
          setTimeout(recheckallNew, 2000);
        } else {
          // T6: ytd-comment-view-model primary; legacy ytd-comment-renderer fallback
          $('ytd-comment-view-model, div#main.style-scope.ytd-comment-renderer').each(function() {
            var cNode = $(this).find(".published-time-text")[0];
            deleteitemNew(this, $(cNode).find("a")[0].href);
          });
        }
      });
    });
    mutationObserver.observe($(jNode)[0], {
      attributes: true,
      attributeFilter: ['active'],
      characterData: false,
      childList: false,
      subtree: true,
      attributeOldValue: false,
      characterDataOldValue: false
    });
  }, false);
  waitForKeyElements('div#continuations.ytd-item-section-renderer', function(jNode) {
    if (getURLParameter('v', location.search) === null) {
      return;
    }
    console.log("[MetaBot for Youtube] Comment loading spinner found.");
    var mutationObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (!$(jNode).find("#spinnerContainer").hasClass("cooldown")) {
          setTimeout(recheckallNew, 2000);
        }
      });
    });
    mutationObserver.observe($(jNode)[0], {
      attributes: true,
      attributeFilter: ['active'],
      characterData: false,
      childList: false,
      subtree: true,
      attributeOldValue: false,
      characterDataOldValue: false
    });
  }, false);
  waitForKeyElements('paper-spinner#spinner.yt-next-continuation[active]', function(jNode) {
    if (getURLParameter('v', location.search) === null) {
      return;
    }
    console.log("[MetaBot for Youtube] Comment replies loading spinner found.");
    var mutationObserver = new MutationObserver(function(mutations) {
      if (mutations[0].removedNodes) {
        mutationObserver.disconnect();
        setTimeout(recheckallNew, 2000);
      }
    });
    mutationObserver.observe($(jNode)[0].parentNode, {
      attributes: true,
      characterData: false,
      childList: false,
      subtree: false,
      attributeOldValue: false,
      characterDataOldValue: false
    });
  }, false);
}

function recheckallNew(){
  // T6: ytd-comment-view-model primary; legacy ytd-comment-renderer fallback
  $('ytd-comment-view-model, div#main.style-scope.ytd-comment-renderer').each(function() {
    recheckNew(this);
  });
}

async function insertchanNew(jNode) {
  this.addEventListener('yt-navigate-finish', function insertchanNewR() {
    this.removeEventListener('yt-navigate-finish', insertchanNewR);
    setTimeout(insertchanNew, 300, jNode);
  });
  var chanURL = window.location.protocol + '//' + window.location.hostname + window.location.pathname.replace(/\/featured|\/videos|\/playlists|\/channels|\/discussion|\/about/i, '');
  if (chanURL.slice(-1) == '/') {
    chanURL = chanURL.slice(0, -1);
  }
  var reuse = false;
  var userID = await normalizeChannelId(chanURL) || chanURL.split('/').pop();
  if ($(jNode).find('span#metabot-chan-badge')[0]) {
    var noticespan = $(jNode).find('span#metabot-chan-badge')[0];
    reuse = true;
  } else {
    var noticespan = document.createElement('span');
    noticespan.id = 'metabot-chan-badge';
    noticespan.classList.add("ytd-channel-name");
  }
  // T19 OPT-2: O(1) Set check, indexOf only when desc text needed
  var inErkySet = arrayERKYSet.has(userID);
  var foundID = inErkySet ? arrayERKY.indexOf(userID) : -1;
  var stylecommon = 'border-radius: 5px; padding: 4px 7px 4px 7px; font-weight: 400; line-height: 3rem; text-transform: none; color: var(--yt-lightsource-primary-title-color); margin-left: 7px';
  var top30 = '<a href="https://www.t30p.ru/search.aspx?s=' + userID + '" target="_blank" style="color: hsl(206.1, 79.3%, 52.7%); text-decoration:none; font-family: Segoe UI Symbol; color: var(--yt-spec-icon-inactive)">\uD83D\uDD0D<tp-yt-paper-tooltip>Найти комментарии автора с помощью агрегатора ТОП30</tp-yt-paper-tooltip></a> ';
  if (foundID > -1) {
    noticespan.innerHTML = top30 + '<a href="' + chanURL + '/about" style="text-decoration: none; font-family: Segoe UI Symbol; color: #cc0000">\uD83D\uDD34<tp-yt-paper-tooltip>Пользователь найден в ЕРКЮ</tp-yt-paper-tooltip></a> ' + arrayERKY[foundID + 1];
    noticespan.style = 'background: rgba(255,50,50,0.3); ' + stylecommon;
  } else {
    noticespan.innerHTML = top30 + '<a href="' + chanURL + '/about" style="text-decoration: none; font-family: Segoe UI Symbol; color: var(--yt-spec-icon-inactive)">\u2139<tp-yt-paper-tooltip>Пользователь не найден в ЕРКЮ</tp-yt-paper-tooltip></a>';
    noticespan.style = 'background: rgba(100,100,100,0.2); ' + stylecommon;
  }
  if (!reuse) {
    // T2: try modern polymer3 title containers first, fallback to legacy
    var titleTarget = $(jNode).find('h1.dynamicTextViewModelH1')[0]
      || $(jNode).find('yt-content-metadata-view-model')[0]
      || $(jNode).find('ytd-channel-name#channel-name')[0]
      || $(jNode).find('ytd-channel-name#channel-name.ytd-c4-tabbed-header-renderer')[0]; // DEAD - legacy
    if (titleTarget) {
      $(titleTarget).append(noticespan);
    } else {
      console.warn('[MetaBot] insertchanNew: channel title target not found, badge not inserted');
    }
  }
}

function preparedmNew(jNode) {
  this.addEventListener('yt-navigate-finish', function preparedmNewR() {
    this.removeEventListener('yt-navigate-finish', preparedmNewR);
    setTimeout(preparedmNew, 300, jNode);
  });
  var videoid = getURLParameter('v', location.search);
  if (!videoid) {
    console.log("[MetaBot for Youtube] Dislikemeter: video id not found.");
    return;
  }
  var pNode = $(jNode).parent().parent().parent().find('div#flex')[0];
  if (typeof pNode === 'undefined') {
    console.log("[MetaBot for Youtube] Dislikemeter: node not found.");
    return;
  }
  pNode.innerHTML = '';
  if (GM_config.get('option3')) {
    var btnText = $(pNode).parent().find('ytd-button-renderer.ytd-menu-renderer')[0];
    if ($(btnText).find('yt-formatted-string#text').length > 0) {
      $(btnText).find('yt-formatted-string#text').html('');
    }
    if (!$(pNode).parent().find('ytd-sentiment-bar-renderer#sentiment').is(":visible")) {
      btnText = $(pNode).parent().find('ytd-toggle-button-renderer.ytd-menu-renderer.force-icon-button')[0];
      $(btnText).find('yt-formatted-string#text').html('');
      btnText = $(pNode).parent().find('ytd-toggle-button-renderer.ytd-menu-renderer.force-icon-button')[1];
      $(btnText).find('yt-formatted-string#text').html('');
    }
  }
  console.log("[MetaBot for Youtube] Return YouTube Dislike: requesting data for video id " + videoid);
  getlist(insertdmNew, pNode, 'https://returnyoutubedislikeapi.com/votes?videoId=' + videoid);
}

function insertdmNew(jNode, response, code, url) {
  try {
    var data = JSON.parse(response);
    var dislikes = data.dislikes || 0;
    var rating = data.rating || 0;
    // red if more than 30% dislikes, green otherwise
    var color = (rating < 0.7) ? '#e05252' : '#52c06e';
    var dmspan = document.createElement('span');
    dmspan.id = 'dmspan';
    dmspan.style.cssText = 'display:inline-flex;align-items:center;margin:0 8px;font-size:1.4rem;color:' + color + ';cursor:default';
    dmspan.title = 'Дизлайки (returnyoutubedislike.com)';
    dmspan.innerHTML = '👎 ' + dislikes.toLocaleString('ru-RU');
    jNode.style.textAlign = "right";
    // remove previous insertion to avoid duplicates
    var prev = $(jNode).find('span#dmspan')[0];
    if (prev) prev.remove();
    $(jNode).prepend(dmspan);
    console.log("[MetaBot for Youtube] Return YouTube Dislike: dislikes=" + dislikes + " rating=" + rating);
  } catch (e) {
    console.warn('[MetaBot] insertdmNew: failed to parse response:', e.message);
  }
}

function insertannNew(jNode) {
  waitForKeyElements('div#icon-label.yt-dropdown-menu', function(jNode) {
    $(jNode)[0].innerHTML = '';
    $(jNode).parent()[0].setAttribute("style","margin-top:-0.1em;height:1.9em;width:2.9em");
    $(jNode).parent().hover(function() {
      this.style.backgroundColor = 'hsl(206.1, 79.3%, 52.7%)';
    }, function() {
      this.style.backgroundColor = '';
    });
  }, false);
  var cfgspan = document.createElement('span');
  cfgspan.innerHTML = '<span style="opacity:0.4">[</span><span style="font-family: Segoe UI Symbol; color: #848484">\uD83D\uDD27</span><span style="opacity:0.4">]</span>';
  cfgspan.id = 'cfgbtn';
  cfgspan.title = 'Настройки MetaBot for YouTube';
  cfgspan.style = 'margin:-6px 0 0 0.5em;font-size:3em;height:1.05em;display:inline-flex;align-items:center;cursor:pointer';
  cfgspan.classList.add("content");
  cfgspan.classList.add("ytd-video-secondary-info-renderer");
  $(jNode).find('div#title').append(cfgspan);
  var annspan = document.createElement('span');
  annspan.innerHTML = '<span style="opacity:0.4">[</span><span style="font-family: Segoe UI Symbol; color: #af1611">\uD83D\uDCE3</span><span style="font-size:0.5em;font-weight:420;margin:0 0.2em 0 0.2em">' + Aparse(annYTOtxt[1]) + '</span><span style="opacity:0.4">]</span>';
  annspan.id = 'annbtn';
  annspan.title = 'Последняя информация от Наблюдателя YouTube (#ЕРКЮ)';
  annspan.style = 'margin:-6px 0 0 0.5em;font-size:3em;height:1.05em;display:inline-flex;align-items:center;cursor:pointer';
  annspan.classList.add("content");
  annspan.classList.add("ytd-video-secondary-info-renderer");
  $(jNode).find('div#title').append(annspan);
  var ytoinfosspan = document.createElement('span');
  ytoinfosspan.innerHTML = '<span style="float:left;width:40px"><img src="' + imgyto + '" width="40px" height="40px" /></span><span style="float:right;margin: 0 0 0 10px;width:585px"><span id="urlyto" style="font-weight:500;cursor:pointer" data-url="https://www.youtube.com/channel/UCwBID52XA-aajCKYuwsQxWA">Наблюдатель Youtube #ЕРКЮ</span><span class="badge badge-style-type-simple ytd-badge-supported-renderer" style="margin:4px 0 4px 0;text-align:center">' + Aparse(annYTOtxt[1]) + '</span><span id="annholder"></span></span>';
  ytoinfosspan.id = 'ytoinfo';
  ytoinfosspan.classList.add("description");
  ytoinfosspan.classList.add("content");
  ytoinfosspan.classList.add("ytd-video-secondary-info-renderer");
  ytoinfosspan.style = 'font-size:1.4rem;max-width:640px;margin:-10px auto 1em auto;display:none';
  $(jNode).find('div#title').after(ytoinfosspan);
  var settingsspan = document.createElement('span');
  settingsspan.innerHTML = `<style>#config{font:13px/1.5 ui-sans-serif,system-ui,sans-serif;color:#ddd;background:#0e0e0e;border-radius:8px;padding:0;position:relative}#config .mb-header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #2a2a2a}#config .mb-header img{width:32px;height:32px;border-radius:4px}#config .mb-header h2{margin:0;font-size:15px;font-weight:600}#config .mb-version{margin-left:auto;font-size:11px;color:#777}#config .mb-section{padding:12px 16px;border-bottom:1px solid #1f1f1f}#config .mb-section h3{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600}#config .mb-row{display:flex;align-items:center;gap:10px;margin:6px 0}#config .mb-row label{flex:1;cursor:pointer}#config input[type="checkbox"]{width:16px;height:16px;cursor:pointer;accent-color:#5af}#config input[type="password"],#config input[type="text"],#config select{background:#1a1a1a;color:#eee;border:1px solid #333;border-radius:4px;padding:5px 8px;font-size:13px;outline:none}#config input:focus,#config select:focus{border-color:#5af}#config .mb-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#2a3a4f;color:#fff;border:1px solid #3a5070;border-radius:4px;cursor:pointer;font-size:13px}#config .mb-btn:hover{background:#3a5070}#config .mb-btn.primary{background:#2a5a3a;border-color:#3a703a}#config .mb-btn.primary:hover{background:#3a703a}#config .mb-tracked-list,#config .mb-networks-list{max-height:120px;overflow-y:auto;background:#161616;padding:6px;border:1px solid #2a2a2a;border-radius:4px;font-size:12px}#config .mb-tracked-item,#config .mb-network-item{display:flex;align-items:center;padding:4px 6px;border-radius:3px}#config .mb-tracked-item:hover,#config .mb-network-item:hover{background:#1f1f1f}#config .mb-remove{color:#f55;cursor:pointer;margin-left:auto;padding:0 6px}#config .mb-stats{font-size:11px;color:#888;margin-top:6px}#config .mb-toast{position:absolute;top:8px;right:8px;background:#2a5a3a;color:#fff;padding:6px 10px;border-radius:4px;font-size:12px;display:none;z-index:10}</style><div class="mb-header"><img src="https://raw.githubusercontent.com/asrdri/yt-metabot-user-js/master/logo.png"><h2>MetaBot · AI Bot Detection</h2><span class="mb-version">v${GM_info.script.version}</span></div><div class="mb-section"><h3>DeepSeek API</h3><div class="mb-row"><label for="deepseek_api_key">API Key:</label><input type="password" id="deepseek_api_key" placeholder="sk-..." style="width:280px"></div><div class="mb-row"><label><input type="checkbox" id="mbAutoClassify"> Авто-классификация для tracked-каналов</label></div></div><div class="mb-section"><h3>Детекция ботов</h3><div style="font-size:11px;color:#888;margin-bottom:6px;line-height:1.5">DeepSeek AI + локальные эвристики (entropy, частота, кросс-канал) + публичные ресурсы:<br><a href="https://botnadzor.org" target="_blank" style="color:#6af">Ботнадзор</a> · <a href="https://euvsdisinfo.eu" target="_blank" style="color:#6af">EUvsDisinfo</a> · <a href="https://factcheck.by" target="_blank" style="color:#6af">Factcheck.BY</a> · <a href="https://dfrlab.org" target="_blank" style="color:#6af">DFRLab</a></div><div class="mb-row"><label>Действие при обнаружении:</label><select id="mbcddm1"><option value="1">Помечать</option><option value="2">Скрывать</option></select></div><div class="mb-row"><label><input type="checkbox" id="mbcbox1"> Авто-дизлайк ботам</label></div><div class="mb-row"><label><input type="checkbox" id="mbcbox2"> Скрывать длинные подписи Like/Dislike</label></div></div><div class="mb-section"><h3>Отслеживаемые каналы <span id="mbTrackedCount" style="font-weight:normal;color:#666"></span></h3><div class="mb-tracked-list" id="mbTrackedList"><div style="color:#666;font-style:italic;padding:8px;text-align:center">Нет отслеживаемых каналов.<br>Откройте видео и нажмите [👁 Отслеживать] под автором.</div></div></div><div class="mb-section"><h3>Известные ботосетки <span id="mbNetworksCount" style="font-weight:normal;color:#666"></span></h3><div class="mb-networks-list" id="mbNetworksList"><div style="color:#666;font-style:italic;padding:8px;text-align:center">Сетки не выявлены.<br>Нажмите [🕸 Кластеризовать] после анализа паттернов.</div></div></div><div class="mb-section"><h3>Действия</h3><div class="mb-row" style="flex-wrap:wrap;gap:6px"><button id="mbClassifyBtn" class="mb-btn primary">🤖 Классифицировать</button><button id="mbAnalyzePatternsBtn" class="mb-btn">🔍 Анализ паттернов</button><button id="mbClusterBtn" class="mb-btn">🕸 Кластеризовать</button></div><div class="mb-stats" id="mbStats">Каналов: 0 · Очередь: 0 · Комментариев: 0 · Сеток: 0</div></div><div class="mb-section" style="border-bottom:none;padding-top:8px"><div class="mb-row" style="font-size:11px;color:#666"><a id="urlgithub" data-url="https://github.com/asrdri/yt-metabot-user-js/" style="color:#6af;cursor:pointer">GitHub</a><span id="mbAboutBtn" style="cursor:pointer;color:#6af;margin:0 12px">ℹ️ О скрипте</span><span style="margin-left:auto"><span id="resetbtn" style="cursor:pointer;color:#a55">Сброс</span></span></div></div><span id="configsaved" class="mb-toast">Сохранено</span>`;
  settingsspan.id = 'config';
  settingsspan.classList.add("description");
  settingsspan.classList.add("content");
  settingsspan.classList.add("ytd-video-secondary-info-renderer");
  settingsspan.style = 'font-size:1.4rem;max-width:635px;margin:-10px auto 1em auto;display:none';
  $(jNode).find('div#title').after(settingsspan);
  var annexspan = document.createElement('span');
  annexspan.innerHTML = Aparse(annYTOtxt[3]);
  annexspan.classList.add("content");
  annexspan.classList.add("ytd-video-secondary-info-renderer");
  $(jNode).find('span#annholder').append(annexspan);
  $(jNode).find("span#cfgbtn")[0].addEventListener("click", function() {
    $(jNode).find("span#config").toggle();
    $(jNode).find("span#ytoinfo").hide();
    // Refresh stats and lists when panel opens
    try { if (typeof refreshStats === 'function') refreshStats(); } catch (e) {}
    try { if (typeof renderTracked === 'function') renderTracked(); } catch (e) {}
    try { if (typeof renderNetworks === 'function') renderNetworks(); } catch (e) {}
  }, false);
  $(jNode).find("span#annbtn")[0].addEventListener("click", function() {
    $(jNode).find("span#ytoinfo").toggle();
    $(jNode).find("span#config").hide();
  }, false);
  $(jNode).find("span#cfgbtn").hover(function() {
    this.style.backgroundColor = 'hsl(206.1, 79.3%, 52.7%)';
  }, function() {
    this.style.backgroundColor = '';
  });
  $(jNode).find("span#annbtn").hover(function() {
    this.style.backgroundColor = 'hsl(206.1, 79.3%, 52.7%)';
  }, function() {
    this.style.backgroundColor = '';
  });
  $(jNode).find("span#resetbtn").hover(function() {
    this.style.textDecoration = "underline";
  }, function() {
    this.style.textDecoration = "";
  });
  $(jNode).find("span#urlgithub, span#urlissues, span#urllists, span#urlyto").hover(function() {
    this.style.textDecoration = "underline";
    this.style.color = "hsl(206.1, 79.3%, 52.7%)";
  }, function() {
    this.style.textDecoration = "";
    this.style.color = "";
  });
  $(jNode).find("span#urlgithub, span#urlissues, span#urllists, span#urlyto").click(function() {
    window.open($(this).attr('data-url'));
  });
  $(jNode).find("span#resetbtn").click(function() {
    resetconfigNew(jNode);
    saveconfigNew(jNode);
  });
  $(jNode).find("select#mbcddm1").val(GM_config.get('option1'));
  $(jNode).find("input#mbcbox1").prop('checked', GM_config.get('option2'));
  $(jNode).find("input#mbcbox2").prop('checked', GM_config.get('option3'));
  $(jNode).find("input#mbcbox3").prop('checked', GM_config.get('option4'));
  $(jNode).find("textarea#listpersonal").text(GM_config.get('listp1'));
  $(jNode).find("input#listcustom1").val(GM_config.get('listc1'));
  $(jNode).find("input#listcustom2").val(GM_config.get('listc2'));
  $(jNode).find("input#listcustom3").val(GM_config.get('listc3'));
  $(jNode).find("input#listcustom4").val(GM_config.get('listc4'));
  $(jNode).find("input#listcustom5").val(GM_config.get('listc5'));
  $(jNode).find("input#deepseek_api_key").val(GM_config.get('deepseek_api_key'));
  $(jNode).find("input#colorpersonal").val(parseColor(GM_config.get('colorp1'), false));
  $(jNode).find("input#colorcustom1").val(parseColor(GM_config.get('colorc1'), false));
  $(jNode).find("input#colorcustom2").val(parseColor(GM_config.get('colorc2'), false));
  $(jNode).find("input#colorcustom3").val(parseColor(GM_config.get('colorc3'), false));
  $(jNode).find("input#colorcustom4").val(parseColor(GM_config.get('colorc4'), false));
  $(jNode).find("input#colorcustom5").val(parseColor(GM_config.get('colorc5'), false));
  if ($(jNode).find("select#mbcddm1").val() == 2) {
    $(jNode).find("span#mbcswg1").hide();
  }
  if ($(jNode).find("input#mbcbox3").prop('checked') == false) {
    $(jNode).find("span#mbcswg2").hide();
  }
  $(jNode).find("input#mbcbox1, input#mbcbox2, input#mbcbox3, select#mbcddm1, textarea#listpersonal, input#listcustom1, input#listcustom2, input#listcustom3, input#listcustom4, input#listcustom5, input#deepseek_api_key, input#colorpersonal, input#colorcustom1, input#colorcustom2, input#colorcustom3, input#colorcustom4, input#colorcustom5").change(function() {
    if ($(jNode).find("select#mbcddm1").val() == 2) {
      $(jNode).find("span#mbcswg1").hide();
    } else {
      $(jNode).find("span#mbcswg1").show();
    }
    if ($(jNode).find("input#mbcbox3").prop('checked') == false) {
      $(jNode).find("span#mbcswg2").hide();
    } else {
      $(jNode).find("span#mbcswg2").show();
    }
    saveconfigNew(jNode);
  });
  $(jNode).find('button#mbClassifyBtn').on('click', function() {
    var $btn = $(this);
    var orig = $btn.text();
    $btn.text('\u2026 \u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u0446\u0438\u0440\u0443\u044E').prop('disabled', true);
    Promise.resolve(typeof classifyBatch === 'function' ? classifyBatch() : null)
      .then(function() { $btn.text(orig).prop('disabled', false); refreshStats && refreshStats(); })
      .catch(function(e) { console.warn('[MetaBot] classify failed:', e); $btn.text(orig).prop('disabled', false); });
  });
  // T14 \u2014 missing handlers for analyze / cluster buttons
  $(jNode).find('button#mbAnalyzePatternsBtn').on('click', function() {
    var $btn = $(this);
    var orig = $btn.text();
    $btn.text('\u2026 \u0410\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u044E').prop('disabled', true);
    Promise.resolve(typeof analyzePatternsBatch === 'function' ? analyzePatternsBatch() : Promise.reject(new Error('analyzePatternsBatch undefined')))
      .then(function() { $btn.text(orig).prop('disabled', false); refreshStats && refreshStats(); renderNetworks && renderNetworks(); })
      .catch(function(e) { console.warn('[MetaBot] analyze failed:', e); $btn.text(orig).prop('disabled', false); showToast && showToast('\u041E\u0448\u0438\u0431\u043A\u0430: ' + e.message); });
  });
  $(jNode).find('button#mbClusterBtn').on('click', function() {
    var $btn = $(this);
    var orig = $btn.text();
    $btn.text('\u2026 \u041A\u043B\u0430\u0441\u0442\u0435\u0440\u0438\u0437\u0443\u044E').prop('disabled', true);
    Promise.resolve(typeof clusterNetworks === 'function' ? clusterNetworks() : Promise.reject(new Error('clusterNetworks undefined')))
      .then(function() { $btn.text(orig).prop('disabled', false); refreshStats && refreshStats(); renderNetworks && renderNetworks(); })
      .catch(function(e) { console.warn('[MetaBot] cluster failed:', e); $btn.text(orig).prop('disabled', false); showToast && showToast('\u041E\u0448\u0438\u0431\u043A\u0430: ' + e.message); });
  });
  $(jNode).find('span#mbAboutBtn').on('click', function() {
    var overlay = document.createElement('div');
    overlay.id = 'mbAboutOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;font:13px/1.6 ui-sans-serif,system-ui,sans-serif;color:#ddd';
    overlay.innerHTML =
      '<div style="background:#0e0e0e;border:1px solid #2a2a2a;border-radius:8px;padding:24px;max-width:680px;max-height:80vh;overflow-y:auto;position:relative">' +
      '<span style="position:absolute;top:8px;right:14px;cursor:pointer;font-size:20px;color:#888" id="mbAboutClose">×</span>' +
      '<h2 style="margin:0 0 12px;font-size:18px;color:#fff">MetaBot · AI Bot Detection</h2>' +
      '<p style="color:#aaa;margin:0 0 16px">Userscript для YouTube — детектирует ботов, новорегов, координированные сети в комментариях.</p>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🎯 Что делает</h3>' +
      '<ul style="margin:0;padding-left:20px;color:#ccc">' +
        '<li><b style="color:#fb8c00">🆕 Новореги</b> — каналы, зарегистрированные менее 7 дней до публикации видео</li>' +
        '<li><b style="color:#e53935">🤖 Боты</b> — AI-классификация поведения (DeepSeek V4) + база ЕРКЮ</li>' +
        '<li><b style="color:#8e24aa">🕸 Ботосетки</b> — кластеризация каналов по поведенческим паттернам</li>' +
        '<li><b style="color:#fbc02d">⚠️ Подозрительные</b> — низкая уверенность бот-сигналов</li>' +
        '<li><b style="color:#43a047">✓ Люди</b> — органичная активность</li>' +
      '</ul>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🚀 Как пользоваться</h3>' +
      '<ul style="margin:0;padding-left:20px;color:#ccc;font-size:12px">' +
        '<li>Установите DeepSeek API key в поле выше (sk-...), нажмите Tab — увидите toast "Сохранено"</li>' +
        '<li>MetaBot автоматически собирает данные о комментаторах при просмотре YouTube</li>' +
        '<li>Когда в очереди ≥10 каналов — нажмите <b>🤖 Классифицировать</b> (batch до 20 каналов в DeepSeek)</li>' +
        '<li>После classify не-HUMAN каналы попадают в очередь анализа паттернов</li>' +
        '<li>Нажмите <b>🔍 Анализ паттернов</b> когда там накопится ≥10</li>' +
        '<li>Нажмите <b>🕸 Кластеризовать</b> когда ≥3 канала с network_signals (выявляет ботосетки)</li>' +
        '<li>Кнопка <b>[👁 Отслеживать]</b> у автора видео — добавит канал для auto-classify</li>' +
      '</ul>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🔬 Методы</h3>' +
      '<ul style="margin:0;padding-left:20px;color:#ccc">' +
        '<li>Сбор комментариев + метаданных каналов локально в IndexedDB</li>' +
        '<li>AI классификация через <b>DeepSeek V4</b> (label + confidence + reasoning)</li>' +
        '<li>Анализ паттернов: themes, targets (Putin/Navalny/Kac/...), network_signals (pro-kremlin, anti-opposition, whataboutism, ...)</li>' +
        '<li>Кластеризация ботосеток: Euclidean distance + union-find по signals</li>' +
        '<li>Кросс-канальное отслеживание: что комментирует на нескольких каналах</li>' +
      '</ul>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🛠 Инструменты</h3>' +
      '<ul style="margin:0;padding-left:20px;color:#ccc">' +
        '<li><b>DeepSeek API</b> — LLM-классификация (~$3/мес при 30K каналов)</li>' +
        '<li><b>IndexedDB</b> — локальная база каналов / комментариев / сетей</li>' +
        '<li><b>Tampermonkey/Violentmonkey</b> — runtime userscript</li>' +
        '<li><b>YouTube DOM scraping</b> — joinDate, subs, videoCount из /about</li>' +
        '<li><b>Return YouTube Dislike API</b> — счётчик дислайков</li>' +
      '</ul>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🔄 Pipeline</h3>' +
      '<pre style="background:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:8px;font-size:11px;color:#aaa;overflow-x:auto;margin:0">' +
'Комментарии YouTube\n' +
'       ↓ (сбор автоматический)\n' +
'[IndexedDB: channels + comments + clf_queue]\n' +
'       ↓ 🤖 Классифицировать\n' +
'[DeepSeek API → label: BOT/SUSPECT/HUMAN/UNKNOWN]\n' +
'       ↓ (не-HUMAN auto-enqueue)\n' +
'[analysis_queue]\n' +
'       ↓ 🔍 Анализ паттернов\n' +
'[DeepSeek API → themes/targets/network_signals]\n' +
'       ↓ ≥3 каналов с signals\n' +
'[🕸 Кластеризовать → networks]\n' +
'       ↓\n' +
'Цветные badges на комментариях' +
      '</pre>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">📚 Базы и источники</h3>' +
      '<ul style="margin:0;padding-left:20px;color:#ccc">' +
        '<li><a href="https://botnadzor.org" target="_blank" style="color:#6af">Ботнадзор</a> — RU база ботов VK (6.1M комментариев, GitHub: <a href="https://github.com/botnadzor/extension" target="_blank" style="color:#6af">extension</a>)</li>' +
        '<li><a href="https://euvsdisinfo.eu" target="_blank" style="color:#6af">EUvsDisinfo</a> — EU EEAS публичная база дезинфо-нарративов</li>' +
        '<li><a href="https://factcheck.by/eng/news/youtube_botnet_march2025/" target="_blank" style="color:#6af">Factcheck.BY</a> — мониторинг YouTube-ботов RU/BY</li>' +
        '<li><a href="https://dfrlab.org/2025/02/24/russia-pravda-network-expands-worldwide/" target="_blank" style="color:#6af">DFRLab</a> — Pravda Network (~190 сайтов), Operation Overload</li>' +
        '<li><a href="https://novayagazeta.eu/articles/2025/12/25/o-chem-sporili-boty" target="_blank" style="color:#6af">НГ Европа</a> — расследования по ботам 2024-2025</li>' +
        '<li><a href="https://github.com/asrdri/yt-metabot-user-js" target="_blank" style="color:#6af">ЕРКЮ (FeignedAccomplice/YOUTUBOTS)</a> — оригинальная база, заброшена с 2021 (~5949 IDs)</li>' +
      '</ul>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">📄 Академические работы</h3>' +
      '<ul style="margin:0;padding-left:20px;color:#ccc;font-size:12px">' +
        '<li><a href="https://arxiv.org/pdf/2005.06558" target="_blank" style="color:#6af">Beskow & Carley 2020</a> — Russian trolls (MH17)</li>' +
        '<li><a href="https://arxiv.org/pdf/2311.05791" target="_blank" style="color:#6af">Shajari 2023</a> — YouTube commenter mob detection (Graph2Vec)</li>' +
        '<li><a href="https://arxiv.org/pdf/2410.22716" target="_blank" style="color:#6af">Cinelli WWW\'25</a> — Cross-Platform CIB</li>' +
      '</ul>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🆘 Если не работает</h3>' +
      '<ul style="margin:0;padding-left:20px;color:#ccc;font-size:12px">' +
        '<li><b>Кнопки не реагируют</b> — F5 страницы, settings panel пересоздаётся</li>' +
        '<li><b>"No API key set"</b> — введите ключ снова, нажмите Tab, проверьте toast</li>' +
        '<li><b>Очередь не растёт</b> — прокрутите вниз к комментариям, дайте 15 сек на сбор</li>' +
        '<li><b>Tampermonkey сломан</b> — переходите на Violentmonkey (стабильнее MV3)</li>' +
        '<li><b>Нет кнопки Отслеживать</b> — выше viewport, прокрутите к заголовку видео</li>' +
      '</ul>' +
      '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🚧 Планы (T17-T20)</h3>' +
      '<ul style="margin:0;padding-left:20px;color:#ccc;font-size:12px">' +
        '<li><b>T17:</b> Локальные F1-F8 эвристики (entropy, repetition, interval regularity) — снижает API calls на 60-70%</li>' +
        '<li><b>T18:</b> Temporal burst detection — выявление координации в 60-сек окнах</li>' +
        '<li><b>T19:</b> Narrative tagging через EUvsDisinfo базу</li>' +
        '<li><b>T20:</b> Pravda Network domain blacklist (190+ доменов из DFRLab)</li>' +
      '</ul>' +
      '<div style="margin-top:18px;padding-top:12px;border-top:1px solid #2a2a2a;color:#666;font-size:11px">' +
        'Версия: v' + GM_info.script.version + ' · Форк MetaBot для YouTube · Под Violentmonkey/Tampermonkey' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var closeIt = function() { overlay.remove(); };
    overlay.querySelector('#mbAboutClose').onclick = closeIt;
    overlay.onclick = function(e) { if (e.target === overlay) closeIt(); };
  });
  // Track-owner button: ensure it exists on every cfg-button render too
  if (typeof ensureTrackButton === 'function') ensureTrackButton();
}

function saveconfigNew(jNode) {
  // Safe setter — current new UI dropped legacy inputs (listpersonal/listcustomN/colorN).
  // Calling .val() on missing element returns undefined and overwrites stored values.
  // Only save if the element exists in DOM.
  function safeSet(key, sel, transform) {
    var el = $(jNode).find(sel);
    if (el.length === 0) return;
    var v = el.is(':checkbox') ? el.is(':checked') : el.val();
    if (v === undefined) return;
    GM_config.set(key, transform ? transform(v) : v);
  }
  safeSet('option1', 'select#mbcddm1');
  safeSet('option2', 'input#mbcbox1');
  safeSet('option3', 'input#mbcbox2');
  safeSet('option4', 'input#mbcbox3');
  safeSet('listp1', 'textarea#listpersonal');
  safeSet('listc1', 'input#listcustom1');
  safeSet('listc2', 'input#listcustom2');
  safeSet('listc3', 'input#listcustom3');
  safeSet('listc4', 'input#listcustom4');
  safeSet('listc5', 'input#listcustom5');
  safeSet('deepseek_api_key', 'input#deepseek_api_key');
  safeSet('colorp1', 'input#colorpersonal', function(v){ return parseColor(v, true); });
  safeSet('colorc1', 'input#colorcustom1', function(v){ return parseColor(v, true); });
  safeSet('colorc2', 'input#colorcustom2', function(v){ return parseColor(v, true); });
  safeSet('colorc3', 'input#colorcustom3', function(v){ return parseColor(v, true); });
  safeSet('colorc4', 'input#colorcustom4', function(v){ return parseColor(v, true); });
  safeSet('colorc5', 'input#colorcustom5', function(v){ return parseColor(v, true); });
  try { arrayListP1 = (GM_config.get('listp1') || '').match(/[^\r\n=]+/g); } catch (e) {}
  GM_config.save();
  $(jNode).find("span#configsaved").show();
  $(jNode).find("span#configsaved")[0].style.backgroundColor = 'rgba(40,150,230,1)';
  setTimeout(function(){$(jNode).find("span#configsaved")[0].style.backgroundColor = 'rgba(40,150,230,0)';}, 400);
}

function resetconfigNew(jNode) {
  $(jNode).find("span#mbcswg1").show();
  $(jNode).find("span#mbcswg2").show();
  $(jNode).find("select#mbcddm1").val(1);
  $(jNode).find("input#mbcbox1").prop('checked', false);
  $(jNode).find("input#mbcbox2").prop('checked', true);
  $(jNode).find("input#mbcbox3").prop('checked', true);
  $(jNode).find("input#listcustom1").val('https://github.com/asrdri/yt-metabot-user-js/raw/master/list-sample.txt');
  $(jNode).find("input#listcustom2").val('');
  $(jNode).find("input#listcustom3").val('');
  $(jNode).find("input#listcustom4").val('');
  $(jNode).find("input#listcustom5").val('');
  $(jNode).find("input#colorpersonal").val(parseColor(33023, false));
  $(jNode).find("input#colorcustom1").val(parseColor(8388863, false));
  $(jNode).find("input#colorcustom2").val(parseColor(16744448, false));
  $(jNode).find("input#colorcustom3").val(parseColor(8421504, false));
  $(jNode).find("input#colorcustom4").val(parseColor(8453888, false));
  $(jNode).find("input#colorcustom5").val(parseColor(51328, false));
}

async function parseitemNew(jNode) {
  // Idempotency guard — skip already-processed comments.
  // Mark on the parent thread renderer (or jNode itself as fallback) — this prevents
  // double-processing when the selector matches BOTH ytd-comment-view-model AND
  // div#main.ytd-comment-renderer inside the same thread (was causing the date
  // to be inserted twice). T4 (MutationObserver) may also fire for both.
  var rawNode = jNode instanceof Element ? jNode : (jNode[0] || jNode);
  var guard = (rawNode.closest && rawNode.closest('ytd-comment-thread-renderer')) || rawNode;
  if (guard.dataset && guard.dataset.metabotDone === '1') return;
  if (guard.dataset) guard.dataset.metabotDone = '1';
  if (GM_config.get('option4') === true) {
    var spanlistpadd = txtlistpadd;
  } else {
    var spanlistpadd = '';
  }
  // T6: ytd-comment-view-model replaced ytd-comment-renderer; #header-author may still exist inside it
  var pNode = $(jNode).find("#header-author")[0];
  $(jNode).hover(function blockShow() {
    $(pNode).find("#t30sp").show();
  }, function blockHide() {
    $(pNode).find("#t30sp").hide();
  });
  var userID = await normalizeChannelId($(jNode).find("a")[0].href) || $(jNode).find("a")[0].href.split('/').pop();
  // AI collector hook — async, not blocking main flow.
  // Wait briefly for YouTube to hydrate comment text into the DOM —
  // parseitemNew can fire before #content-text is populated, which was leaving
  // text:"" in IDB and making AI classification useless.
  (async function(userID, jNode) {
    try {
      await new Promise(function(r){ setTimeout(r, 700); });
      var videoId = (location.search.match(/[?&]v=([^&]+)/) || [])[1];
      function extractText(node) {
        var sels = [
          'ytd-comment-view-model #content-text',
          '#content-text',
          'yt-attributed-string',
          '#content',
          '.yt-core-attributed-string'
        ];
        for (var i = 0; i < sels.length; i++) {
          var el = $(node).find(sels[i]).first();
          var t = el.text ? el.text().trim() : '';
          if (t && t.length > 0) return t;
        }
        return '';
      }
      var commentText = extractText(jNode).slice(0, 1000);
      // One retry if still empty (slow hydration)
      if (!commentText) {
        await new Promise(function(r){ setTimeout(r, 1200); });
        commentText = extractText(jNode).slice(0, 1000);
      }
      // T19 OPT-1: use batch buffer instead of direct IDB write (saves ~4.6ms per comment)
      _mbIdbBatch.queueComment({
        channelId: userID,
        videoId: videoId,
        text: commentText,
        timestamp: Date.now(),
        isReply: !!jNode.closest('ytd-comment-replies-renderer')
      });
      var channel = await mbdb.getChannel(userID);
      // ALWAYS apply badge — even for unknown channels show UNKNOWN/NEW_REG.
      // Previously only known channels got badges → lazy-loaded comments stayed untagged.
      var channelData = channel || { channelId: userID, label: null };
      applyBadge(jNode, channelData);
      // Local heuristics — only if no AI/user label AND not yet computed (heuristic_at guard)
      if (channel && !channel.label && !channel.user_label && !channel.heuristic_at) {
        var deferHeur = function() {
          mbdb.getComments(userID, 10).then(function(allComments) {
            mbHeuristics.compute(channel, allComments).then(function(heur) {
              var now = Date.now();
              if (heur.verdict) {
                // T19 OPT-1: batch upsert — will merge with any pending writes for same channel
                _mbIdbBatch.queueUpsert({
                  channelId: userID,
                  heuristic_label: heur.verdict,
                  heuristic_score: heur.score,
                  heuristic_signals: heur.signals,
                  heuristic_at: now
                });
                // Re-read after flush (400ms) and update badge
                setTimeout(function() {
                  mbdb.getChannel(userID).then(function(updated) {
                    if (updated) applyBadge(jNode, updated);
                  }).catch(function(){});
                }, 500);
              } else {
                // Mark as checked so we don't re-run on every new comment from this channel
                // T19 OPT-1: batch the no-verdict mark too
                _mbIdbBatch.queueUpsert({ channelId: userID, heuristic_at: now });
              }
            }).catch(function(e) { console.warn('[MetaBot Heur] compute failed:', e.message); });
          }).catch(function(e) { console.warn('[MetaBot Heur] getComments failed:', e.message); });
        };
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(deferHeur, { timeout: 5000 });
        } else {
          setTimeout(deferHeur, 1000);
        }
      }
      if (!channel || !channel.label) {
        mbdb.enqueueForClassification(userID).catch(function(){});
      }
    } catch (e) { console.warn('[MetaBot AI] collector failed:', e.message); }
  })(userID, jNode);
  // T19 OPT-2: O(1) Set
  var foundID = arrayERKYSet.has(userID) ? arrayERKY.indexOf(userID) : -1;
  var foundIDp1 = -1;
  var foundIDc1 = -1;
  var foundIDc2 = -1;
  var foundIDc3 = -1;
  var foundIDc4 = -1;
  var foundIDc5 = -1;
  if (GM_config.get('option4') === true) {
    if (arrayListP1 !== null) {
      foundIDp1 = arrayListP1.indexOf(userID);
    }
    if (typeof arrayListC1 !== 'undefined' && arrayListC1.length > 1) {
      foundIDc1 = arrayListC1.indexOf(userID);
    }
    if (typeof arrayListC2 !== 'undefined' && arrayListC2.length > 1) {
      foundIDc2 = arrayListC2.indexOf(userID);
    }
    if (typeof arrayListC3 !== 'undefined' && arrayListC3.length > 1) {
      foundIDc3 = arrayListC3.indexOf(userID);
    }
    if (typeof arrayListC4 !== 'undefined' && arrayListC4.length > 1) {
      foundIDc4 = arrayListC4.indexOf(userID);
    }
    if (typeof arrayListC5 !== 'undefined' && arrayListC5.length > 1) {
      foundIDc5 = arrayListC5.indexOf(userID);
    }
  }
  var comURL = $(jNode).find(".published-time-text")[0];
  var t30span = document.createElement('span');
  t30span.innerHTML = '\u2003<span id="about" style="cursor: pointer; ' + iconstyledef + '" title="Открыть страницу с датой регистрации">\u2753</span>\u2003<span id="top30" style="cursor: pointer" title="Найти другие комментарии автора с помощью агрегатора ТОП30"><font color="#7777fa">top</font><font color="#fa7777">30</font></span>' + spanlistpadd;
  t30span.id = 't30sp';
  t30span.style = "display:none";
  var newspan = document.createElement('span');
  newspan.id = 'checksp';
  if (foundID > -1) {
    console.log("[MetaBot for Youtube] user found in ERKY-db: " + userID);
    if (GM_config.get('option1') == 2) {
      foundIDp1 = -1;
      foundIDc1 = -1;
      foundIDc2 = -1;
      foundIDc3 = -1;
      foundIDc4 = -1;
      foundIDc5 = -1;
      var hidspan = document.createElement('span');
      hidspan.innerHTML = 'Комментарий скрыт: пользователь найден в ЕРКЮ';
      hidspan.classList.add('badge');
      hidspan.classList.add('badge-style-type-simple');
      hidspan.classList.add('ytd-badge-supported-renderer');
      hidspan.style = 'margin: 0 0 10px 0;text-align:center';
      $(jNode).parent().parent().after(hidspan);
      $(jNode).parent().parent().hide();
    } else {
      markbotNew($(pNode).parent(), arrayERKY[foundID + 1]);
    }
    $(comURL).append(t30span);
    $(newspan).attr('data-chan', $(jNode).find("a#author-text")[0].href);
    pNode.insertBefore(newspan, pNode.firstChild);
  } else {
    newspan.innerHTML = '<img id="checkbtn" src="' + checkb + '" title="Проверить дату регистрации" style="cursor: help" />';
    $(newspan).attr('data-chan', $(jNode).find("a#author-text")[0].href);
    pNode.insertBefore(newspan, pNode.firstChild);
    t30span.innerHTML += '\u2003<span id="sendlink" style="cursor: pointer" title="Помогите пополнить список известных ботов - отправьте нам данные о подозрительном комментарии">\u27A4</span>';
    $(comURL).append(t30span);
    $(jNode).find("#checkbtn")[0].addEventListener("click", function checkcommentNew() {
      checkdateNew($(pNode).parent());
    }, false);
    $(jNode).find("#sendlink")[0].addEventListener("click", function displayinfoNew() {
      sendinfo();
    }, false);
  }
  if (GM_config.get('option4') === true) {
    if (foundIDc1 > -1) {
      markcustomNew($(pNode).parent(), arrayListC1[foundIDc1 + 1], 1);
    }
    if (foundIDc2 > -1) {
      markcustomNew($(pNode).parent(), arrayListC2[foundIDc2 + 1], 2);
    }
    if (foundIDc3 > -1) {
      markcustomNew($(pNode).parent(), arrayListC3[foundIDc3 + 1], 3);
    }
    if (foundIDc4 > -1) {
      markcustomNew($(pNode).parent(), arrayListC4[foundIDc4 + 1], 4);
    }
    if (foundIDc5 > -1) {
      markcustomNew($(pNode).parent(), arrayListC5[foundIDc5 + 1], 5);
    }
    if (foundIDp1 > -1) {
      if ($(jNode).find("#checkbtn").length > 0) {
        $(jNode).find("#checkbtn")[0].remove();
      }
      markpersonalNew($(pNode).parent(), arrayListP1[foundIDp1 + 1]);
    }
    $(jNode).find("#listpadd")[0].addEventListener("click", function addtolistNew() {
      if ($(pNode).find("span#bookmark").length > 0) {
        listpdelNew(pNode);
        $(jNode).find("#listpadd").html(iconsdef[0]);
        $(jNode).find("#listpadd")[0].title = 'Добавить в закладки';
      } else {
        if ($(jNode).find("#checkbtn").length > 0) {
          $(jNode).find("#checkbtn")[0].remove();
        }
        $(jNode).find("#listpadd").html('\u23F3');
        getpage(listpaddNew, pNode, $(jNode).find("a")[0].href + '/about')
      }
    }, false);
  }
  $(jNode).find("#about")[0].addEventListener("click", function openaboutNew() {
    window.open($(jNode).find("a")[0].href + '/about');
  }, false);
  $(jNode).find("#top30")[0].addEventListener("click", function opent30New() {
    window.open('https://www.t30p.ru/search.aspx?s=' + userID);
  }, false);
  this.addEventListener('yt-navigate-start', function wipeitemNewS() {
    this.removeEventListener('yt-navigate-start', wipeitemNewS);
    deleteitemNew(jNode, $(comURL).find("a")[0].href);
  });
  this.addEventListener('yt-navigate-finish', function wipeitemNewF() {
    this.removeEventListener('yt-navigate-finish', wipeitemNewF);
    deleteitemNew(jNode, $(comURL).find("a")[0].href);
  });
}

function recheckNew(jNode) {
  var checkre = $(jNode).find("#checksp")[0];
  if (typeof checkre !== 'undefined') {
    if ($(checkre).attr('data-chan') !== $(jNode).find("a#author-text")[0].href) {
      $(jNode).find("#checksp").remove();
      $(jNode).find("#t30sp").remove();
      $(jNode).find("#botmark").remove();
      var cNode = $(jNode).parent().parent().find("#content-text");
      $(cNode).parent().removeAttr('style');
      $(cNode).removeAttr('style');
      // DEAD - ytd-comment-action-buttons-renderer removed from YT DOM; modern dislike has no extra style to clear
      // $(jNode).find("ytd-toggle-button-renderer.ytd-comment-action-buttons-renderer:eq(1)").removeAttr('style');
      parseitemNew(jNode);
    }
  }
}

function deleteitemNew(jNode, url) {
  if (url.length > 74) {
    $(jNode).parent().parent().remove();
  } else {
    $(jNode).parent().parent().parent().remove();
  }
}

function sendinfo() {
  var answer = confirm('Будет запущен Telegram.' +
    '\n\nПрисоединитесь к группе, отправьте ссылку на подозрительный' +
    '\nкомментарий (можно скопировать из даты публикации) и обоснуйте подозрения.\n\nПерейти к группе?');
  if (answer) {
    window.open(reporturl);
  }
}

function listpaddNew(jNode, response, url) {
  var matches = regexdate.exec(response);
  if (!matches) {
    matches = regexdateOld.exec(response);
    if (!matches) {
      console.warn('[MetaBot] listpadd: joinedDate parse failed for', url);
      $(jNode).find("#listpadd").html(iconsdef[0]);
      return;
    }
    var day = Dparse(matches[3]);
  } else {
    var day = Dparse(matches[1]);
  }
  $('textarea#listpersonal')[0].value += url.substring(0, url.length - 6).split('/').pop() + '=' + day + '\n';
  var tempArray = $('textarea#listpersonal')[0].value.split('\n');
  var uniqArray = tempArray.reduce(function(a,b){
    if (a.indexOf(b) < 0) a.push(b);
    return a;
  },[]);
  $('textarea#listpersonal')[0].value = uniqArray.join('\n');
  GM_config.set('listp1', uniqArray.join('\n'));
  GM_config.save();
  arrayListP1 = GM_config.get('listp1').match(/[^\r\n=]+/g);
  $(jNode).find("#listpadd").html('\u274C');
  $(jNode).find("#listpadd")[0].title = 'Удалить из закладок';
  markpersonalNew($(jNode).parent(), day);
  console.log("[MetaBot for Youtube] Bookmarks (personal list) updated.");
}

function listpdelNew(jNode) {
  $(jNode).find("span#bookmark").remove();
  var tempArray = $('textarea#listpersonal')[0].value.split('\n');
  var itemDel = arrayListP1.indexOf($(jNode).find("a")[0].href.split('/').pop());
  tempArray.splice(itemDel / 2,1);
  $('textarea#listpersonal')[0].value = tempArray.join('\n');
  GM_config.set('listp1', tempArray.join('\n'));
  GM_config.save();
  arrayListP1 = GM_config.get('listp1').match(/[^\r\n=]+/g);
  $(jNode).parent().parent().find("#content-text").parent().css({
    "background-image": "none",
    "border-right": "",
    "padding-right": ""
  });
  console.log("[MetaBot for Youtube] Bookmarks (personal list) updated.");
}

async function checkdateNew(jNode) {
  if (['en', 'en-US', 'en-GB', 'ru', 'uk', 'be', 'bg'].indexOf(currentlangNew()) < 0) {
    alert('Функция поддерживается только на языках:\n \u2714 English\n \u2714 Русский\n \u2714 Українська\n \u2714 Беларуская \u2714 Български\nВы можете сменить язык интерфейса в меню настроек YouTube.');
    return;
  }
  $(jNode).find("#checkbtn")[0].remove();
  var userID = await normalizeChannelId($(jNode).find("a")[0].href) || $(jNode).find("a")[0].href.split('/').pop();
  // T19 OPT-2: O(1) Set
  var foundID = arrayERKYSet.has(userID) ? arrayERKY.indexOf(userID) : -1;
  if (foundID > -1) {
    console.log("[MetaBot for Youtube] user found in ERKY-db: " + userID);
    markbotNew(jNode, arrayERKY[foundID + 1]);
  } else {
    getpage(procdateNew, jNode, $(jNode).find("a")[0].href + '/about');
  }
}

async function procdateNew(jNode, response, url) {
  try {
    var testday;
    // try new YouTube format first (2022+): joinedDateText":{"content":"..."}
    var matches = regexdate.exec(response);
    if (!matches) {
      // fallback to old format: joinedDateText...ext":"..."ext":"..."
      matches = regexdateOld.exec(response);
      if (!matches) {
        console.warn('[MetaBot] joinedDate parse failed: no match in response for', url);
        return;
      }
      // old format: date is in group 3
      testday = Dparse(matches[3]);
    } else {
      // new format: date is in group 1
      testday = Dparse(matches[1]);
    }
    var aNode = $(jNode).find("#author-text")[0];
    var cNode = $(jNode).parent().find("#content-text")[0];
    var newspan = document.createElement('span');
    newspan.id = 'botmark';
    var checkBadge = $(aNode).parent().find('span#author-comment-badge')[0];
    newspan.innerHTML = '<img src="' + minf + '" title="Дата регистрации:" /> ' + testday;
    $(aNode).append(newspan);
    if ($(checkBadge).length > 0) {
      $(checkBadge).attr('hidden', '');
      $(aNode).removeAttr('hidden');
    }
    $(cNode).parent().css({
      "background": "rgba(170,170,170,0.3)",
      "border-left": "3px solid rgba(170,170,170,0.3)",
      "padding-left": "3px"
    });
    aNode = $(jNode).find("#checksp");
    aNode.attr('data-chan', $(jNode).find("a#author-text")[0].href);
    aNode.hide();
    // AI: scrape subscriber count and video count from /about page
    try {
      var subMatch = response.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/);
      var vidMatch = response.match(/"videoCount":"(\d+)"/);
      var channelId = $(jNode).find("a")[0].href.split('/').pop();
      if (channelId.startsWith('@')) {
        var resolved = await normalizeChannelId($(jNode).find("a")[0].href);
        if (resolved) channelId = resolved;
      }
      var channelData = {channelId: channelId, joinDate: testday, lastSeen: Date.now()};
      if (subMatch) channelData.subscriberCount = subMatch[1];
      if (vidMatch) channelData.videoCount = parseInt(vidMatch[1], 10);
      await mbdb.upsertChannel(channelData);
    } catch (aiErr) {
      console.warn('[MetaBot AI] channel meta scrape failed:', aiErr.message);
    }
  } catch (err) {
    console.warn('[MetaBot] joinedDate parse failed for', url, ':', err.message);
  }
}

var MB_COLORS = { BOT:'#e53935', NETWORK:'#8e24aa', NEW_REG:'#fb8c00', SUSPECT:'#fbc02d', HUMAN:'#43a047', UNKNOWN:'#757575' };
var MB_BADGES = { BOT:'🤖 БОТ', NETWORK:'🕸 СЕТЬ', NEW_REG:'🆕 НОВОРЕГ', SUSPECT:'⚠️ ПОДОЗР', HUMAN:'✓ ЧЕЛОВЕК', UNKNOWN:'? UNK' };

function getVideoPublishDate() {
  if (window._mbCurrentVideoPublishDate) return window._mbCurrentVideoPublishDate;
  var src = null;
  var meta = document.querySelector('meta[itemprop="datePublished"]');
  if (meta && meta.content) src = meta.content;
  if (!src) {
    var info = document.querySelector('#info-strings yt-formatted-string, ytd-video-primary-info-renderer #date yt-formatted-string');
    if (info && info.textContent) src = info.textContent;
  }
  if (!src) {
    try {
      var m = document.documentElement.innerHTML.match(/"publishDate":\{"simpleText":"([^"]+)"/);
      if (m) src = m[1];
    } catch (e) {}
  }
  if (!src) return null;
  var d = new Date(src);
  if (isNaN(d)) return null;
  window._mbCurrentVideoPublishDate = d;
  return d;
}
document.addEventListener('yt-navigate-finish', function() {
  window._mbCurrentVideoPublishDate = null;
});

function isNewReg(joinDate, videoPublishDate) {
  if (!joinDate || !videoPublishDate) return false;
  var join = new Date(joinDate);
  var pub = new Date(videoPublishDate);
  if (isNaN(join) || isNaN(pub)) return false;
  var diffDays = (pub.getTime() - join.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays < 7;
}

function applyBadge(jNode, channel) {
  try {
    var root = jNode instanceof Element ? jNode : (jNode[0] || jNode);
    if (!root || !root.querySelector) return;
    // Skip re-render if badge state hasn't changed
    var sig = (channel.user_label||'') + '|' + (channel.heuristic_label||'') + '|' + (channel.label||'') + '|' + (channel.network_cluster_id||'') + '|' + (channel.joinDate||'');
    if (root._mbBadgeSig === sig) return;
    root._mbBadgeSig = sig;
    var author = root.querySelector('#author-text');
    if (!author) return;
    var oldBadge = author.parentNode.querySelector('.mb-ai-badge');
    if (oldBadge) oldBadge.remove();
    var thread = root.closest ? root.closest('ytd-comment-thread-renderer') : null;
    // Compute states — user_label has TOP priority (manual override)
    var states = [];
    if (channel.user_label) {
      states.push(channel.user_label);
    } else if (channel.heuristic_label && !channel.label) {
      if (channel.heuristic_label === 'BOT_HEURISTIC') states.push('BOT');
      else if (channel.heuristic_label === 'SUSPECT_HEURISTIC') states.push('SUSPECT');
      else if (channel.heuristic_label === 'HUMAN_HEURISTIC') states.push('HUMAN');
    } else {
      var inErky = (typeof arrayERKYSet !== 'undefined' && arrayERKYSet.has(channel.channelId)); // T19 OPT-2
      if (channel.label === 'BOT' || inErky) states.push('BOT');
      if (channel.network_cluster_id) states.push('NETWORK');
      if (isNewReg(channel.joinDate, getVideoPublishDate())) states.push('NEW_REG');
      if (channel.label === 'SUSPECT' && states.indexOf('SUSPECT') < 0) states.push('SUSPECT');
      if (channel.label === 'HUMAN' && states.length === 0) states.push('HUMAN');
      if (states.length === 0) states.push('UNKNOWN');
    }
    var primary = states[0];
    // T19 OPT-5: build badge into DocumentFragment first, then single insertion to live DOM.
    // Avoids reflow/repaint on each appendChild into a connected node.
    var frag = document.createDocumentFragment();
    var container = document.createElement('span');
    container.className = 'mb-ai-badge';
    container.style.cssText = 'margin-left:8px;font-size:11px;font-weight:600;cursor:help;display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap';
    states.forEach(function(state, i) {
      if (i > 0) {
        var sep = document.createElement('span');
        sep.textContent = '·'; // ·
        sep.style.cssText = 'color:#666;margin:0 2px';
        container.appendChild(sep);
      }
      var pill = document.createElement('span');
      pill.style.cssText = 'background:' + MB_COLORS[state] + '22;color:' + MB_COLORS[state] + ';padding:2px 6px;border-radius:10px;border:1px solid ' + MB_COLORS[state] + '55';
      pill.textContent = MB_BADGES[state];
      container.appendChild(pill);
    });
    if (channel.user_label) {
      var userMark = document.createElement('span');
      userMark.textContent = '👤';
      userMark.title = 'Установлено вручную ' + new Date(channel.user_label_at).toLocaleString();
      userMark.style.cssText = 'margin-left:4px;font-size:10px;opacity:0.7';
      container.appendChild(userMark);
    }
    if (channel.heuristic_label && !channel.label && !channel.user_label) {
      var heurMark = document.createElement('span');
      heurMark.textContent = '🧮';
      heurMark.title = 'Локальная эвристика (без AI): score ' + (channel.heuristic_score || 0);
      heurMark.style.cssText = 'margin-left:4px;font-size:10px;opacity:0.7';
      container.appendChild(heurMark);
    }
    var lines = [];
    lines.push(primary + (channel.confidence ? ' · ' + Math.round(channel.confidence*100) + '%' : ''));
    if (channel.analysisSummary) lines.push(channel.analysisSummary);
    else if (channel.reasoning) lines.push(channel.reasoning);
    if (channel.joinDate) {
      var pub = getVideoPublishDate();
      var ageLine = 'Зарегистрирован: ' + channel.joinDate;
      if (pub) {
        var diff = Math.floor((new Date(pub).getTime() - new Date(channel.joinDate).getTime()) / 86400000);
        if (diff >= 0 && diff < 365) ageLine += ' (' + diff + ' дн. до видео)';
      }
      lines.push(ageLine);
    }
    if (channel.network_cluster_id) {
      lines.push('🕸 Кластер: ' + channel.network_cluster_id);
    }
    if (channel.targets) {
      var tops = Object.entries(channel.targets).map(function(kv){
        var k = kv[0], v = kv[1] || {};
        var score = (v.pro || 0) - (v.anti || 0);
        return { k: k, score: score };
      }).sort(function(a,b){ return Math.abs(b.score) - Math.abs(a.score); }).slice(0,3);
      if (tops.length) lines.push('Цели: ' + tops.map(function(t){ return t.k + (t.score>0?' +':' ') + t.score; }).join(' · '));
    }
    container.title = lines.join('\n');

    // ⓘ info badge — custom popover with human-readable classification reasoning
    (function(capturedChannel, capturedStates, capturedPrimary) {
      var info = document.createElement('span');
      info.textContent = 'ⓘ';
      info.style.cssText = 'margin-left:4px;color:#888;cursor:help;font-size:11px;font-weight:normal';
      info.setAttribute('data-mb-info', '1');

      function buildExplanation(state, ch) {
        var parts = [];
        if (ch.user_label) {
          parts.unshift('Установлено вручную (' + new Date(ch.user_label_at).toLocaleString() + ')');
        }
        if (state === 'BOT') {
          if (ch.reasoning) parts.push('AI: ' + ch.reasoning);
          if (ch.confidence) parts.push('Уверенность: ' + Math.round(ch.confidence*100) + '%');
          if (typeof arrayERKYSet !== 'undefined' && arrayERKYSet.has(ch.channelId)) parts.push('В базе ЕРКЮ'); // T19 OPT-2
        } else if (state === 'NETWORK') {
          parts.push('Канал в кластере "' + (ch.network_cluster_id || 'unknown') + '"');
          parts.push('Похожее поведение с другими каналами этой сети');
        } else if (state === 'NEW_REG') {
          var pubD = getVideoPublishDate();
          var join = ch.joinDate;
          if (pubD && join) {
            var d = Math.floor((new Date(pubD).getTime() - new Date(join).getTime()) / 86400000);
            parts.push('Канал зарегистрирован за ' + d + ' дн. до публикации видео');
            parts.push('Дата регистрации: ' + join);
          }
        } else if (state === 'SUSPECT') {
          if (ch.reasoning) parts.push('AI: ' + ch.reasoning);
          parts.push('Низкая уверенность бот-сигналов (<70%)');
        } else if (state === 'HUMAN') {
          if (ch.reasoning) parts.push('AI: ' + ch.reasoning);
          parts.push('Поведение похоже на органическую активность');
        } else if (state === 'UNKNOWN') {
          parts.push('Канал ещё не классифицирован.');
          parts.push('Нажмите 🤖 Классифицировать чтобы определить статус.');
        }
        if (ch.heuristic_signals && ch.heuristic_signals.length > 0) {
          parts.push('Эвристика (score ' + (ch.heuristic_score || 0) + '): ' + ch.heuristic_signals.join(', '));
        }
        if (ch.analysisSummary) { parts.push('---'); parts.push(ch.analysisSummary); }
        if (ch.targets && Object.keys(ch.targets).length) {
          parts.push('---');
          var tops = Object.entries(ch.targets).map(function(kv) {
            return kv[0] + ': pro ' + ((kv[1]||{}).pro||0) + ', anti ' + ((kv[1]||{}).anti||0);
          }).slice(0,3);
          parts.push('Цели: ' + tops.join(' | '));
        }
        return parts.join('\n');
      }

      info.onmouseenter = function() {
        var existing = document.getElementById('mbReasonPopover');
        if (existing) existing.remove();
        var popover = document.createElement('div');
        popover.id = 'mbReasonPopover';
        popover.style.cssText = 'position:fixed;background:#1a1a1a;border:1px solid #444;border-radius:6px;padding:10px 14px;color:#ddd;font-size:12px;line-height:1.5;max-width:380px;z-index:99998;box-shadow:0 4px 16px rgba(0,0,0,0.5);white-space:pre-wrap;font-family:ui-sans-serif,system-ui,sans-serif';
        var rect = info.getBoundingClientRect();
        popover.style.left = Math.min(rect.left + 20, window.innerWidth - 400) + 'px';
        popover.style.top = Math.min(rect.top + 20, window.innerHeight - 200) + 'px';
        var stateName = MB_BADGES[capturedPrimary] || capturedPrimary;
        var explanation = buildExplanation(capturedPrimary, capturedChannel);
        popover.innerHTML = '<div style="font-weight:600;margin-bottom:6px;color:' + MB_COLORS[capturedPrimary] + '">' + stateName + '</div>' + explanation.replace(/\n/g, '<br>');

        // Manual override buttons
        var btnBar = document.createElement('div');
        btnBar.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #333;display:flex;flex-wrap:wrap;gap:4px;align-items:center';
        var labelEl = document.createElement('div');
        labelEl.textContent = 'Установить статус вручную:';
        labelEl.style.cssText = 'width:100%;font-size:11px;color:#888;margin-bottom:4px';
        btnBar.appendChild(labelEl);
        var overrideLabels = [
          ['BOT', '🤖 БОТ'],
          ['NETWORK', '🕸 СЕТЬ'],
          ['NEW_REG', '🆕 НОВОРЕГ'],
          ['SUSPECT', '⚠️ ПОДОЗР'],
          ['HUMAN', '✓ ЧЕЛОВЕК'],
          ['UNKNOWN', '? UNK']
        ];
        overrideLabels.forEach(function(pair) {
          var key = pair[0], txt = pair[1];
          var b = document.createElement('button');
          b.textContent = txt;
          b.style.cssText = 'background:' + MB_COLORS[key] + '22;color:' + MB_COLORS[key] + ';border:1px solid ' + MB_COLORS[key] + '55;border-radius:8px;padding:3px 8px;font-size:11px;cursor:pointer';
          b.onclick = async function(ev) {
            ev.stopPropagation();
            try {
              await mbdb.setUserLabel(capturedChannel.channelId, key);
              if (typeof showToast === 'function') showToast('Статус: ' + txt);
              if (typeof refreshBadgesForChannel === 'function') await refreshBadgesForChannel(capturedChannel.channelId);
              var pop = document.getElementById('mbReasonPopover');
              if (pop) pop.remove();
            } catch (e) { console.warn('[MetaBot] setUserLabel failed:', e.message); }
          };
          btnBar.appendChild(b);
        });
        if (capturedChannel.user_label) {
          var reset = document.createElement('button');
          reset.textContent = '↻ Сбросить override';
          reset.style.cssText = 'background:transparent;color:#888;border:1px dashed #444;border-radius:8px;padding:3px 8px;font-size:11px;cursor:pointer;margin-left:8px';
          reset.onclick = async function(ev) {
            ev.stopPropagation();
            try {
              await mbdb.setUserLabel(capturedChannel.channelId, null);
              if (typeof showToast === 'function') showToast('Override сброшен');
              if (typeof refreshBadgesForChannel === 'function') await refreshBadgesForChannel(capturedChannel.channelId);
              var pop = document.getElementById('mbReasonPopover');
              if (pop) pop.remove();
            } catch (e) { console.warn('[MetaBot] reset failed:', e.message); }
          };
          btnBar.appendChild(reset);
        }
        popover.appendChild(btnBar);

        // Keep popover alive when mouse is on it
        popover.onmouseenter = function() { popover._mbHover = true; };
        popover.onmouseleave = function() { popover._mbHover = false; popover.remove(); };

        document.body.appendChild(popover);
      };
      info.onmouseleave = function() {
        setTimeout(function() {
          var p = document.getElementById('mbReasonPopover');
          if (p && !p._mbHover) p.remove();
        }, 200);
      };
      container.appendChild(info);
    })(channel, states, primary);

    // T19 OPT-5: finalize DocumentFragment — single DOM insertion (no intermediate reflow)
    frag.appendChild(container);
    author.parentNode.insertBefore(frag, author.nextSibling);
    if (thread) {
      thread.style.borderLeft = '3px solid ' + MB_COLORS[primary];
      thread.style.paddingLeft = '8px';
    }
  } catch (e) { console.warn('[MetaBot] applyBadge failed:', e.message); }
}

async function refreshBadgesForChannel(channelId) {
  // T19 OPT-4: avoid normalizeChannelId HTTP fetch for each author-text.
  // Strategy: skip @handle authors that are already in L1/L2 cache with a different ID.
  // For UCxxx hrefs: direct string match — O(1), no network.
  // For @handle hrefs: only call normalizeChannelId if cache has a match or cache miss (may fetch).
  // Also: early-exit on first match is wrong if channel comments multiple times — process all.
  try {
    var channel = await mbdb.getChannel(channelId);
    if (!channel) return;
    var authors = document.querySelectorAll('#author-text');
    var handleCache = window._mbHandleCache || new Map();
    for (var i = 0; i < authors.length; i++) {
      var href = authors[i].href || '';
      if (!href) continue;
      var tail = href.split('/').pop().split('?')[0];
      // Fast path: UCxxx direct match
      if (tail.startsWith('UC') && tail.length === 24) {
        if (tail === channelId) {
          var view = authors[i].closest('ytd-comment-view-model, ytd-comment-renderer, ytd-comment-thread-renderer');
          if (view) applyBadge(view, channel);
        }
        continue;
      }
      // @handle path: only resolve if L1 cache says it matches OR it's a cache miss
      if (tail.startsWith('@')) {
        var l1 = handleCache.get(tail);
        if (l1 === undefined) {
          // Cache miss — resolve (may hit IDB L2, rarely network)
          var nid = await normalizeChannelId(href);
          if (nid === channelId) {
            var view2 = authors[i].closest('ytd-comment-view-model, ytd-comment-renderer, ytd-comment-thread-renderer');
            if (view2) applyBadge(view2, channel);
          }
        } else if (l1 === channelId) {
          var view3 = authors[i].closest('ytd-comment-view-model, ytd-comment-renderer, ytd-comment-thread-renderer');
          if (view3) applyBadge(view3, channel);
        }
        // if l1 is a different channelId: skip (no match)
        continue;
      }
    }
  } catch (e) { console.warn('[MetaBot] refreshBadges failed:', e.message); }
}

async function computePatterns(channelId) {
  try {
    var channel = await mbdb.getChannel(channelId);
    var comments = await mbdb.getComments(channelId, 50);
    if (!channel || comments.length === 0) return {commentCount: 0};
    var joinAgeDays = channel.joinDate ? Math.floor((Date.now() - new Date(channel.joinDate).getTime()) / 86400000) : null;
    var commentCount = comments.length;
    var firstTs = comments[comments.length - 1].timestamp;
    var weeksSinceFirst = firstTs ? Math.max(1, (Date.now() - firstTs) / 604800000) : 1;
    var avgCommentsPerWeek = commentCount / weeksSinceFirst;
    // Peak hour MSK (UTC+3)
    var hours = comments.map(function(c) { return new Date(c.timestamp).getUTCHours(); });
    var hourCounts = {};
    hours.forEach(function(h) { hourCounts[(h + 3) % 24] = (hourCounts[(h + 3) % 24] || 0) + 1; });
    var peakHourMSK = parseInt(Object.keys(hourCounts).sort(function(a,b) { return hourCounts[b] - hourCounts[a]; })[0], 10) || 0;
    // Peak weekday
    var weekdays = comments.map(function(c) { return new Date(c.timestamp).getUTCDay(); });
    var wdCounts = {};
    weekdays.forEach(function(d) { wdCounts[d] = (wdCounts[d] || 0) + 1; });
    var peakWeekday = parseInt(Object.keys(wdCounts).sort(function(a,b) { return wdCounts[b] - wdCounts[a]; })[0], 10) || 0;
    // Weekday vs weekend ratio
    var weekdayCount = weekdays.filter(function(d) { return d >= 1 && d <= 5; }).length;
    var weekendCount = weekdays.filter(function(d) { return d === 0 || d === 6; }).length;
    var weekdayVsWeekendRatio = weekendCount > 0 ? weekdayCount / weekendCount : weekdayCount;
    // Avg comment length
    var avgCommentLength = comments.reduce(function(sum, c) { return sum + (c.text || '').length; }, 0) / commentCount;
    // Channel diversity
    var uniqueVideos = new Set(comments.map(function(c) { return c.videoId; }));
    var channelDiversity = uniqueVideos.size;
    return {
      joinAgeDays: joinAgeDays,
      commentCount: commentCount,
      avgCommentsPerWeek: Math.round(avgCommentsPerWeek * 10) / 10,
      peakHourMSK: peakHourMSK,
      peakWeekday: peakWeekday,
      weekdayVsWeekendRatio: Math.round(weekdayVsWeekendRatio * 10) / 10,
      avgCommentLength: Math.round(avgCommentLength),
      channelDiversity: channelDiversity
    };
  } catch (e) {
    console.warn('[MetaBot AI] computePatterns failed:', e.message);
    return {commentCount: 0};
  }
}

function markbotNew(jNode, txt) {
  var aNode = $(jNode).find("#author-text")[0];
  var cNode = $(jNode).parent().find("#content-text")[0];
  var newspan = document.createElement('span');
  newspan.id = 'botmark';
  newspan.innerHTML = '<img src="' + mred + '" title="- найден в #ЕРКЮ, дата регистрации -" /> ' + txt;
  $(aNode).append(newspan);
  var checkBadge = $(aNode).parent().find('span#author-comment-badge')[0];
  if ($(checkBadge).length > 0) {
    $(checkBadge).attr('hidden', '');
    $(aNode).removeAttr('hidden');
  }
  if (regexalt.exec(txt) === null) {
    $(cNode).parent().css({
      "background": "rgba(255,50,50,0.3)",
      "border-left": "3px solid rgba(255,50,50,0.3)",
      "padding-left": "3px"
    });
  } else {
    $(cNode).parent().css({
      "background": "rgba(255,0,150,0.3)",
      "border-left": "3px solid rgba(255,0,150,0.3)",
      "padding-left": "3px"
    });
    $(cNode).parent().parent().css({
      "background": "repeating-linear-gradient(135deg, rgba(140,140,140,0.1), rgba(140,140,140,0.1) 10px, rgba(0,0,0,0) 10px, rgba(0,0,0,0) 20px)"
    });
  }
  if (GM_config.get('option2') === true) {
    requestDislike(jNode, true);
  }
}

function markcustomNew(jNode, txt, list) {
  switch (list) {
    case 1:
      var listname = Aparse(arrayListC1[0]);
      break
    case 2:
      var listname = Aparse(arrayListC2[0]);
      break
    case 3:
      var listname = Aparse(arrayListC3[0]);
      break
    case 4:
      var listname = Aparse(arrayListC4[0]);
      break
    case 5:
      var listname = Aparse(arrayListC5[0]);
  }
  var aNode = $(jNode).find("#author-text")[0];
  var cNode = $(jNode).parent().find("#content-text")[0];
  var checkBadge = $(aNode).parent().find('span#author-comment-badge')[0];
  var botmark = $(cNode).parent().parent().parent().find("#botmark");
  var rgbCustom = gmColor('colorc' + list, 1) + "," + gmColor('colorc' + list, 2) + "," + gmColor('colorc' + list, 3);
  var marktxt = '<span style="' + iconstyledef + ' color: rgb(' + rgbCustom + '); font-size: 1.3em;" title="Найден в списке ' + listname + '">' + iconsdef[list] + '</span> ';
  if (botmark.length > 0) {
    $(botmark).prepend(marktxt);
  } else {
    $(jNode).find("#checkbtn")[0].remove();
    var newspan = document.createElement('span');
    newspan.id = 'botmark';
    newspan.innerHTML = marktxt + txt;
    $(aNode).append(newspan);
    if ($(checkBadge).length > 0) {
      $(checkBadge).attr('hidden', '');
      $(aNode).removeAttr('hidden');
    }
    $(cNode).parent().css({
      "background": "rgba(" + rgbCustom + ",.3)",
      "border-left": "3px solid rgba(" + rgbCustom + ",0.3)",
      "padding-left": "3px"
    });
  }
}

function markpersonalNew(jNode, txt) {
  $(jNode).find("#listpadd").html('\u274C');
  $(jNode).find("#listpadd")[0].title = 'Удалить из закладок';
  var aNode = $(jNode).find("#author-text")[0];
  var cNode = $(jNode).parent().find("#content-text")[0];
  var checkBadge = $(aNode).parent().find('span#author-comment-badge')[0];
  var botmark = $(cNode).parent().parent().parent().find("#botmark");
  var rgbCustom = gmColor('colorp1', 1) + "," + gmColor('colorp1', 2) + "," + gmColor('colorp1', 3);
  var marktxt = '<span id="bookmark" style="' + iconstyledef + ' color: rgb(' + rgbCustom + '); font-size: 1.3em;" title="Добавлен в закладки">' + iconsdef[0] + '</span> ';
  if (botmark.length > 0) {
    $(botmark).prepend(marktxt);
    $(cNode).parent().css({
      "background-image": "linear-gradient(230deg, rgba(" + rgbCustom + ",.4) 20%, rgba(0,0,0,0) 30%)"
    });
  } else {
    var newspan = document.createElement('span');
    newspan.id = 'botmark';
    newspan.innerHTML = marktxt + txt;
    $(aNode).append(newspan);
    if ($(checkBadge).length > 0) {
      $(checkBadge).attr('hidden', '');
      $(aNode).removeAttr('hidden');
    }
    $(cNode).parent().css({
      "background": "linear-gradient(230deg, rgba(" + rgbCustom + ",.4) 20%, rgba(0,0,0,0) 30%)"
    });
  }
  $(cNode).parent().css({
    "background-origin": "border-box",
    "border-right": "3px solid rgba(" + rgbCustom + ",.3)",
    "padding-right": "3px"
  });
}

function gmColor(gmVar, colpos) {
  return parseInt(parseColor(GM_config.get(gmVar), false).slice(colpos*2-1, colpos*2+1), 16)
}

function requestDislike(jNode) {
  var element;
  // T6: modern YT uses ytd-comment-view-model + #action-buttons; search scoped to comment node
  // Selectors cover EN ("Dislike") and RU ("не нравится") locales; aria-pressed=false = not yet clicked
  var commentNode = $(jNode).parent()[0] || jNode;
  var btn = commentNode.querySelector('#action-buttons button[aria-label*="islike" i], #action-buttons button[aria-label*="не нравится" i]');
  if (btn && btn.getAttribute('aria-pressed') === 'false') {
    element = btn;
  }
  // DEAD - ytd-toggle-button-renderer.ytd-comment-action-buttons-renderer no longer in YT DOM
  // element = $(jNode).parent().find("ytd-toggle-button-renderer.ytd-comment-action-buttons-renderer:not(.style-default-active)")[1];
  if (element) orderedClicksArray.push(element);
  if (bDTaskSet == 0) {
    bDTaskSet = 1;
    setTimeout(scheduledDislike, minDCTime + Math.random() * (maxDCTime - minDCTime));
  }
}

function scheduledDislike() {
  // T6: modern dialog check — tp-yt-paper-dialog[opened] or native dialog[open]; keep legacy paper-dialog as fallback
  var dialogOpen = document.querySelector('tp-yt-paper-dialog[opened], dialog[open]')
    || document.querySelector('paper-dialog.ytd-popup-container:not([style*="display:none"]):not([style*="display: none"])'); // DEAD - legacy
  if ( bDBlur || dialogOpen || document.querySelector('label.option-selectable-item-renderer-radio-container') ) {
    setTimeout(scheduledDislike, minDCTime + Math.random() * (maxDCTime - minDCTime));
  } else {
    if (orderedClicksArray.length) {
      var element = orderedClicksArray.shift();
      // T6: primary state check via aria-pressed; fallback to legacy class check
      var alreadyPressed = element.getAttribute('aria-pressed') === 'true'
        || element.classList.contains('style-default-active'); // DEAD - legacy class
      if (!alreadyPressed) {
        $(element).css({"background": "rgba(255,50,50,0.3)"});
        $(element).css({"border-radius": "50%"});
        element.click();
      } else {
        setTimeout(scheduledDislike, 100);
        return;
      }
      setTimeout(scheduledDislike, minDCTime + Math.random() * (maxDCTime - minDCTime));
    } else {
      bDTaskSet = 0;
    }
  }
}

function Dparse(day) {
  day = day.replace(/Joined |Дата регистрации: |Ви приєдналися |Член от |Далучыўся(-лася) /i, '');
  day = day.replace(/ янв\. | января | січ\. | сту |\.01\./i, ' Jan, ');
  day = day.replace(/ февр\. | февраля | лют\. | лют |\.02\./i, ' Feb, ');
  day = day.replace(/ мар\. | марта | бер\. | сак |\.03\./i, ' Mar, ');
  day = day.replace(/ апр\. | апреля | квіт\. | кра |\.04\./i, ' Apr, ');
  day = day.replace(/ мая\. | мая | трав\. |\.05\./i, ' May, ');
  day = day.replace(/ июн\. | июня | черв\.| чэр |\.06\./i, ' Jun, ');
  day = day.replace(/ июл\. | июля | лип\. | ліп |\.07\./i, ' Jul, ');
  day = day.replace(/ авг\. | августа | серп\. | жні |\.08\./i, ' Aug, ');
  day = day.replace(/ сент\. | сентября | вер\. | вер |\.09\./i, ' Sep, ');
  day = day.replace(/ окт\. | октября | жовт\. | кас |\.10\./i, ' Oct, ');
  day = day.replace(/ нояб\. | ноября | лист\. | ліс |\.11\./i, ' Nov, ');
  day = day.replace(/ дек\. | декабря | груд\. | сне |\.12\./i, ' Dec, ');
  day = day.replace(/ г\.| г\.| р\.| р\./i, '');
  return Dymd(day);
}

function Dymd(day) {
  var ymd = new Date(day);
  return new Date(ymd.getTime() - (ymd.getTimezoneOffset()*60000)).toISOString().split("T")[0];
}

function Aparse(text) {
  text = text.replace(/&/g, '&amp;');
  text = text.replace(/</g, '&lt;');
  text = text.replace(/>/g, '&gt;');
  text = text.replace(/\r\n/g, '<br>');
  text = text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" style="color:rgba(39,147,230,1);">$1</a>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  text = text.replace(/\*(.*?)\*/g, '<i>$1</i>');
  text = text.replace(/__(.*?)__/g, '<u>$1</u>');
  return text;
}

function currentlangNew() {
  return regexlang.exec(document.head.innerHTML)[1];
}

function getURLParameter(name, link) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=([^&;]+?)(&|#|;|$)').exec(link) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}

function parseColor(color, toNumber) {
  if (toNumber === true) {
    if (typeof color === 'number') {
      return (color | 0);
    }
    if (typeof color === 'string' && color[0] === '#') {
      color = color.slice(1);
    }
    return parseInt(color, 16);
  } else {
    color = '#' + ('00000' + (color | 0).toString(16)).substr(-6);
    return color;
  }
}

// ===== AI-augmented bot detection — DeepSeek connector =====
async function callDeepSeek(messages) {
  // fix 2026-05-27: read via GM_config.get (where saveconfigNew writes),
  // fallback to GM_getValue. Previously only GM_getValue → always empty
  // because GM_config.save() bundles all fields under 'ytmetabot_config'.
  var apiKey = '';
  try { apiKey = GM_config.get('deepseek_api_key') || ''; } catch (e) {}
  if (!apiKey) {
    try { apiKey = GM_getValue('deepseek_api_key', '') || ''; } catch (e) {}
  }
  apiKey = (apiKey || '').trim();
  if (!apiKey) throw new Error('[MetaBot AI] No DeepSeek API key set in settings');
  return new Promise(function(resolve, reject) {
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        response_format: {type: 'json_object'},
        temperature: 0.2,
        max_tokens: 2000
      }),
      onload: function(r) {
        if (r.status !== 200) return reject(new Error('[MetaBot AI] HTTP ' + r.status + ': ' + r.responseText.slice(0, 200)));
        try { resolve(JSON.parse(r.responseText)); }
        catch (e) { reject(e); }
      },
      onerror: reject,
      timeout: 30000
    });
  });
}

var MB_SYSTEM_PROMPT = 'You are a YouTube comment behavior analyst. Classify YouTube channels as BOT, SUSPECT, or HUMAN based on their comment patterns and account metadata. Respond with JSON: {"classifications": [{"channelId": "...", "label": "BOT|SUSPECT|HUMAN", "confidence": 0.0-1.0, "reasoning": "..."}]}. Consider: very new accounts with high activity = suspicious; repetitive short comments = bot; diverse comments across many videos = human; peak posting at 3-7AM MSK = bot pattern.';

function buildPromptMessages(channels) {
  return [
    {role: 'system', content: MB_SYSTEM_PROMPT},
    {role: 'user', content: 'Channels:\n' + JSON.stringify(channels, null, 2)}
  ];
}

async function classifyBatch() {
  try {
    var db = await mbdb.getDb();
    var queue = await mbdb.dequeueBatch(20);
    if (queue.length === 0) {
      console.log('[MetaBot AI] classifyBatch: queue empty');
      return;
    }
    console.log('[MetaBot AI] classifyBatch: processing', queue.length, 'channels');
    var channelData = [];
    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      var channel = await mbdb.getChannel(item.channelId);
      var patterns = await computePatterns(item.channelId);
      var comments = await mbdb.getComments(item.channelId, 5);
      channelData.push({
        channelId: item.channelId,
        joinDate: channel ? channel.joinDate : null,
        subscriberCount: channel ? channel.subscriberCount : null,
        videoCount: channel ? channel.videoCount : null,
        sampleComments: comments.map(function(c) { return c.text; }),
        patterns: patterns
      });
    }
    var messages = buildPromptMessages(channelData);
    var response = await callDeepSeek(messages);
    var parsed = JSON.parse(response.choices[0].message.content);
    if (parsed.classifications && Array.isArray(parsed.classifications)) {
      for (var j = 0; j < parsed.classifications.length; j++) {
        var c = parsed.classifications[j];
        await mbdb.applyClassification(c.channelId, c.label, c.confidence, c.reasoning);
        console.log('[MetaBot AI] classified', c.channelId, '->', c.label, '(' + Math.round(c.confidence * 100) + '%)');
        refreshBadgesForChannel(c.channelId);
      }
    }
    GM_setValue('mb_total_input_tokens', (GM_getValue('mb_total_input_tokens', 0) + (response.usage ? (response.usage.prompt_tokens || 0) : 0)));
    GM_setValue('mb_total_output_tokens', (GM_getValue('mb_total_output_tokens', 0) + (response.usage ? (response.usage.completion_tokens || 0) : 0)));
    console.log('[MetaBot AI] classifyBatch done, tokens:', GM_getValue('mb_total_input_tokens', 0), 'in /', GM_getValue('mb_total_output_tokens', 0), 'out');
  } catch (e) {
    console.warn('[MetaBot AI] classifyBatch failed:', e.message);
  }
}

$(window).focus(function() {
  bDBlur = 0;
});

$(window).blur(function() {
  bDBlur = 1;
});

// T19 OPT-3: normalizeChannelId — two-tier cache:
//   L1: in-memory Map (instant, LRU-evict at 300 entries)
//   L2: IDB 'handle_cache' store with TTL 7 days (survives page reload)
// Prevents repeated HTTP fetches for the same @handle on every page reload.
// In-memory Map had no LRU before — grew unbounded on channels with 1000+ @handle comments.
var _mbHandleCacheTTL = 7 * 24 * 3600 * 1000; // 7 days in ms
var _mbHandleCacheMaxSize = 300; // LRU evict at this size

// Ensure IDB store exists (added in version 4 migration)
mbdb._ensureHandleCacheStore = function() {
  if (mbdb._handleCacheStoreEnsured) return Promise.resolve();
  return new Promise(function(resolve) {
    var req = indexedDB.open('metabot_db', 4);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('handle_cache')) {
        var hs = db.createObjectStore('handle_cache', {keyPath: 'handle'});
        hs.createIndex('by_expiry', 'expiry', {unique: false});
      }
      // Carry over all existing stores unchanged
    };
    req.onsuccess = function(e) {
      // Replace cached db promise with upgraded db
      mbdb._dbPromise = Promise.resolve(e.target.result);
      mbdb._handleCacheStoreEnsured = true;
      resolve();
    };
    req.onerror = function() {
      // Non-fatal: fall back to L1 only
      mbdb._handleCacheStoreEnsured = true;
      resolve();
    };
  });
};

mbdb.getHandle = function(handle) {
  return mbdb.getDb().then(function(db) {
    if (!db.objectStoreNames.contains('handle_cache')) return null;
    return new Promise(function(resolve) {
      var req = db.transaction('handle_cache', 'readonly').objectStore('handle_cache').get(handle);
      req.onsuccess = function() {
        var rec = req.result;
        if (!rec || rec.expiry < Date.now()) { resolve(null); return; }
        resolve(rec.channelId);
      };
      req.onerror = function() { resolve(null); };
    });
  }).catch(function() { return null; });
};

mbdb.setHandle = function(handle, channelId) {
  return mbdb.getDb().then(function(db) {
    if (!db.objectStoreNames.contains('handle_cache')) return;
    var tx = db.transaction('handle_cache', 'readwrite');
    tx.objectStore('handle_cache').put({
      handle: handle,
      channelId: channelId,
      expiry: Date.now() + _mbHandleCacheTTL
    });
  }).catch(function() {});
};

// Cache for @handle -> UCxxx resolutions (lazy-init on window to avoid TDZ when
// normalizeChannelId is called from hoisted async functions earlier in the file)
async function normalizeChannelId(href) {
  if (!window._mbHandleCache) window._mbHandleCache = new Map();
  var handleCache = window._mbHandleCache;
  if (!href) return null;
  var tail = href.split('/').pop().split('?')[0];
  // Already a UCxxx ID
  if (tail.startsWith('UC') && tail.length === 24) return tail;
  // Handle URL: /@ChannelName
  if (tail.startsWith('@')) {
    // L1: in-memory
    if (handleCache.has(tail)) return handleCache.get(tail);

    // T19 OPT-3: L2 — IDB persistent cache (survives reload)
    try {
      await mbdb._ensureHandleCacheStore();
      var cached = await mbdb.getHandle(tail);
      if (cached !== null) {
        // Promote to L1 with LRU eviction
        if (handleCache.size >= _mbHandleCacheMaxSize) {
          handleCache.delete(handleCache.keys().next().value);
        }
        handleCache.set(tail, cached);
        return cached;
      }
    } catch (e) { /* IDB unavailable — continue to network */ }

    try {
      var responseText = await new Promise(function(resolve, reject) {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
          GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://www.youtube.com/' + tail,
            onload: function(r) { resolve(r.responseText); },
            onerror: reject,
            timeout: 5000
          });
        } else {
          fetch('https://www.youtube.com/' + tail).then(function(r) { return r.text(); }).then(resolve).catch(reject);
        }
      });
      var match = responseText.match(/<meta\s+itemprop="channelId"\s+content="(UC[^"]+)"/i);
      if (match) {
        // LRU evict if L1 full
        if (handleCache.size >= _mbHandleCacheMaxSize) {
          handleCache.delete(handleCache.keys().next().value);
        }
        handleCache.set(tail, match[1]);
        mbdb.setHandle(tail, match[1]); // persist to L2 async (no await — fire-and-forget)
        return match[1];
      }
      // fallback: inline JSON
      var fallback = responseText.match(/"channelId":"(UC[^"]+)"/);
      if (fallback) {
        if (handleCache.size >= _mbHandleCacheMaxSize) {
          handleCache.delete(handleCache.keys().next().value);
        }
        handleCache.set(tail, fallback[1]);
        mbdb.setHandle(tail, fallback[1]);
        return fallback[1];
      }
    } catch (e) {
      console.warn('[MetaBot] handle resolve failed for', tail, ':', e.message);
    }
    // cache negative to avoid repeated retries (short TTL: session only — not persisted)
    handleCache.set(tail, null);
    return null;
  }
  // Unknown format, return as-is
  return tail;
}

function getpage(callback, jNode, url) {
  var request = new XMLHttpRequest();
  request.onreadystatechange = function() {
    if (request.readyState === 4) {
      if (request.status === 200) {
        if (request.responseText !== "") {
          console.log("[MetaBot for Youtube] XMLHttpRequest done: " + url);
          callback(jNode, request.responseText, url);
        }
      }
    }
  };
  request.open("GET", url, true);
  request.send(null);
}

function getlist(callback, numArr, url) {
  if (typeof GM_xmlhttpRequest !== 'undefined') {
    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      onload: function(response) {
        callback(numArr, response.responseText, response.status, url);
      }
    });
  } else if (typeof GM !== 'undefined') {
    GM.xmlHttpRequest({
      method: "GET",
      url: url,
      onload: function(response) {
        callback(numArr, response.responseText, response.status, url);
      }
    });
  } else {
    console.log("[MetaBot for Youtube] Unable to get supported cross-origin XMLHttpRequest function.");
  }
}

function waitForKeyElements(selectorTxt,actionFunction,bWaitOnce) {
  var targetNodes, btargetsFound;
  targetNodes = document.querySelectorAll(selectorTxt);
  if (targetNodes  &&  targetNodes.length > 0) {
    btargetsFound = true;
    targetNodes.forEach(function(element) {
      var alreadyFound = element.dataset.found == 'alreadyFound' ? 'alreadyFound' : false;
      if (!alreadyFound) {
        var cancelFound  = actionFunction (element);
        if (cancelFound) btargetsFound = false;
        else element.dataset.found = 'alreadyFound';
      }
    });
  } else {
    btargetsFound = false;
  }
  var controlObj = waitForKeyElements.controlObj || {};
  var controlKey = selectorTxt.replace(/[^\w]/g, "_");
  var timeControl = controlObj[controlKey];
  if (btargetsFound && bWaitOnce && timeControl) {
    clearInterval(timeControl);
    delete controlObj[controlKey];
  } else {
    if (!timeControl) {
      // T19 OPT-6: reduced polling from 300ms→500ms for non-critical selectors.
      // waitForKeyElements fires 3.3x/sec × 4 selectors = 13 querySelectorAll/sec.
      // 500ms cut this to 8/sec — comment rendering MutationObserver handles new nodes anyway.
      timeControl = setInterval(function() {
        waitForKeyElements(selectorTxt, actionFunction, bWaitOnce);
      }, 500);
      controlObj[controlKey] = timeControl;
    }
  }
  waitForKeyElements.controlObj = controlObj;
}

// T4: MutationObserver for infinite-scroll comment loading on modern YT
// (paper-spinner-lite / paper-spinner#spinner removed in post-2022 Polymer → Lit migration)
function setupCommentObserver() {
  var comments = document.querySelector('ytd-comments#comments, #comments');
  if (!comments) {
    if (window._metabotObserverRetries === undefined) window._metabotObserverRetries = 0;
    if (window._metabotObserverRetries++ < 30) {
      setTimeout(setupCommentObserver, 1000);
    }
    return;
  }
  if (window._metabotObserver) return;

  var pendingNodes = new Set();
  var flushTimer = null;
  function flushPending() {
    var batch = Array.from(pendingNodes);
    pendingNodes.clear();
    flushTimer = null;
    for (var i = 0; i < batch.length; i++) {
      try { parseitemNew(batch[i]); } catch (e) { console.warn('[MetaBot] observer parseitem failed:', e.message); }
    }
  }
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.matches && node.matches('ytd-comment-thread-renderer, ytd-comment-view-model')) {
          pendingNodes.add(node);
        } else if (node.querySelectorAll) {
          // Process nested renderers inside loaded batch containers and reply threads
          var inner = node.querySelectorAll('ytd-comment-thread-renderer, ytd-comment-view-model, ytd-comment-replies-renderer ytd-comment-view-model, ytd-comment-replies-renderer ytd-comment-renderer');
          for (var k = 0; k < inner.length; k++) pendingNodes.add(inner[k]);
        }
      }
    }
    if (!flushTimer && pendingNodes.size > 0) {
      flushTimer = setTimeout(flushPending, 250);
    }
  });
  observer.observe(comments, { childList: true, subtree: true });
  window._metabotObserver = observer;
  console.log('[MetaBot] MutationObserver attached to #comments (debounced 250ms)');
}

// T4: YouTube SPA — reset observer on navigation to new video
document.addEventListener('yt-navigate-finish', function() {
  if (window._metabotObserver) {
    window._metabotObserver.disconnect();
    window._metabotObserver = null;
  }
  window._metabotObserverRetries = 0;
  if (typeof ytmode !== 'undefined' && ytmode === 1) {
    setTimeout(setupCommentObserver, 2000);
  }
});