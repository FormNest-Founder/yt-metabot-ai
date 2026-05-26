// ==UserScript==
// @name         MetaBot for YouTube
// @namespace    yt-metabot-user-js
// @description  More information about users and videos on YouTube.
// @version      230203
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

mbdb.open = function() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('metabot_db', 1);
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
      var tx = db.transaction('channels', 'readwrite');
      var store = tx.objectStore('channels');
      var getReq = store.get(channelId);
      getReq.onsuccess = function() {
        var data = getReq.result || {channelId: channelId};
        data.label = label;
        data.confidence = confidence;
        data.reasoning = reasoning;
        data.classifiedAt = Date.now();
        data.lastSeen = Date.now();
        store.put(data);
      };
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function(e) { reject(e.target.error); };
    });
  });
};

console.log("[MetaBot for Youtube] Starting at URL: " + window.location);
if (window.location.pathname == '/live_chat_replay' || window.location.pathname == '/live_chat') {
  console.log("[MetaBot for Youtube] Live Chat page detected. Skipping.");
} else {
  waitforinit();
}

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
  var foundID = arrayERKY.indexOf(userID);
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
  settingsspan.innerHTML = '<span style="float:left;width:100px"><img src="https://raw.githubusercontent.com/asrdri/yt-metabot-user-js/master/logo.png" width="100px" height="100px" /></span><span style="float:right;margin: 0 0 0 10px;width:525px"><span style="font-weight:500">' + GM_info.script.name + ' v' + GM_info.script.version + '</span>\u2003<span id="urlgithub" style="cursor:pointer" data-url="https://github.com/asrdri/yt-metabot-user-js/">GitHub</span>\u2003<span id="urlissues" style="cursor:pointer" data-url="https://github.com/asrdri/yt-metabot-user-js/issues">Предложения и баги</span>\u2003<span id="urllists" style="cursor:pointer" data-url="https://github.com/asrdri/yt-metabot-user-js/issues/23">Списки</span><span class="badge badge-style-type-simple ytd-badge-supported-renderer" style="margin:4px 0 4px 0;text-align:center">Настройки</span>Комментарии от известных ботов из ЕРКЮ <select id="mbcddm1"><option value="1">помечать</option><option value="2">скрывать</option></select><span id="mbcswg1"><br style="line-height:2em"><label title="Пункт 5.1.H Условий использования YouTube не нарушается - запросы отправляются со значительным интервалом"><input type="checkbox" id="mbcbox1">Автоматически ставить <span style="font-family: Segoe UI Symbol">\uD83D\uDC4E</span> комментариям от ботов из ЕРКЮ</label></span><br style="line-height:2em"><label title="Актуально для русского интерфейса и небольшой ширины окна браузера"><input type="checkbox" id="mbcbox2">Скрывать длинные подписи кнопок Мне (не) понравилось / Поделиться</label><br style="line-height:2em"><label><input type="checkbox" id="mbcbox3">Дополнительные списки</label><span id="mbcswg2"><br style="line-height:2em">' + iconp1 + ' Закладки: <input type="color" id="colorpersonal" style="height: 1.8rem; width: 40px"><br style="line-height:1.8em"><textarea id="listpersonal" rows="3" style="width: 500px"></textarea><br style="line-height:1.2em">Сторонние списки:<br>' + iconc1 + descc1 + '<input type="text" id="listcustom1" style="height: 1.7rem; width: 440px"> <input type="color" id="colorcustom1" style="height: 1.8rem; width: 40px"><br>' + iconc2 + descc2 + '<input type="text" id="listcustom2" style="height: 1.7rem; width: 440px"> <input type="color" id="colorcustom2" style="height: 1.8rem; width: 40px"><br>' + iconc3 + descc3 + '<input type="text" id="listcustom3" style="height: 1.7rem; width: 440px"> <input type="color" id="colorcustom3" style="height: 1.8rem; width: 40px"><br>' + iconc4 + descc4 + '<input type="text" id="listcustom4" style="height: 1.7rem; width: 440px"> <input type="color" id="colorcustom4" style="height: 1.8rem; width: 40px"><br>' + iconc5 + descc5 + '<input type="text" id="listcustom5" style="height: 1.7rem; width: 440px"> <input type="color" id="colorcustom5" style="height: 1.8rem; width: 40px"></span><br style="line-height:2em">Классический дизайн YouTube:' + Aparse("\u2003[Chrome](https://chrome.google.com/webstore/detail/youtube-redux/mdgdgieddpndgjlmeblhjgljejejkikf)\u2003[Firefox](https://addons.mozilla.org/firefox/addon/youtube-redux/)") + '<br><span id="resetbtn" style="cursor:pointer">Сбросить настройки</span><span id="configsaved" class="badge badge-style-type-simple ytd-badge-supported-renderer" style="margin:4px 0 4px 0;text-align:center;display:none;-webkit-transition: background-color 0.3s ease-in-out;-moz-transition: background-color 0.3s ease-in-out;-ms-transition: background-color 0.3s ease-in-out;-o-transition: background-color 0.3s ease-in-out;transition: background-color 0.3s ease-in-out;">Настройки сохранены. Для вступления в силу необходимо <span style="cursor:pointer;text-decoration:underline" onclick="javascript:window.location.reload();"><span style="font-family: Segoe UI Symbol">\uD83D\uDD03</span>обновить страницу</span>.</span><br style="line-height:2em"><button id="mbClassifyBtn" style="padding:6px 16px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer">\uD83E\uDD16 AI Classify now</button><br style="line-height:1.5em"><label style="font-size:13px">API Key: <input type="password" id="deepseek_api_key" style="width:280px;background:#222;color:#fff;border:1px solid #555;border-radius:3px;padding:3px 6px" placeholder="sk-..."></label></span>';
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
    $(this).text('Classifying...').prop('disabled', true);
    classifyBatch().then(function() {
      $(jNode).find('button#mbClassifyBtn').text('\uD83E\uDD16 AI Classify now').prop('disabled', false);
    });
  });
}

function saveconfigNew(jNode) {
  GM_config.set('option1', $(jNode).find("select#mbcddm1").val());
  GM_config.set('option2', $(jNode).find("input#mbcbox1").is(":checked"));
  GM_config.set('option3', $(jNode).find("input#mbcbox2").is(":checked"));
  GM_config.set('option4', $(jNode).find("input#mbcbox3").is(":checked"));
  GM_config.set('listp1', $(jNode).find("textarea#listpersonal").val());
  GM_config.set('listc1', $(jNode).find("input#listcustom1").val());
  GM_config.set('listc2', $(jNode).find("input#listcustom2").val());
  GM_config.set('listc3', $(jNode).find("input#listcustom3").val());
  GM_config.set('listc4', $(jNode).find("input#listcustom4").val());
  GM_config.set('listc5', $(jNode).find("input#listcustom5").val());
  GM_config.set('deepseek_api_key', $(jNode).find("input#deepseek_api_key").val());
  GM_config.set('colorp1', parseColor($(jNode).find("input#colorpersonal").val(), true));
  GM_config.set('colorc1', parseColor($(jNode).find("input#colorcustom1").val(), true));
  GM_config.set('colorc2', parseColor($(jNode).find("input#colorcustom2").val(), true));
  GM_config.set('colorc3', parseColor($(jNode).find("input#colorcustom3").val(), true));
  GM_config.set('colorc4', parseColor($(jNode).find("input#colorcustom4").val(), true));
  GM_config.set('colorc5', parseColor($(jNode).find("input#colorcustom5").val(), true));
  arrayListP1 = GM_config.get('listp1').match(/[^\r\n=]+/g);
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
      await mbdb.addComment({
        channelId: userID,
        videoId: videoId,
        text: commentText,
        timestamp: Date.now(),
        isReply: !!jNode.closest('ytd-comment-replies-renderer')
      });
      var channel = await mbdb.getChannel(userID);
      if (!channel || !channel.label) {
        await mbdb.enqueueForClassification(userID);
      } else {
        applyBadge(jNode, channel);
      }
    } catch (e) { console.warn('[MetaBot AI] collector failed:', e.message); }
  })(userID, jNode);
  var foundID = arrayERKY.indexOf(userID);
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
  var foundID = arrayERKY.indexOf(userID);
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

function applyBadge(jNode, channel) {
  if (!channel || !channel.label || channel.label === 'UNKNOWN') return;
  var colors = {BOT: '#ff5050', SUSPECT: '#ffaa00', HUMAN: '#50c050', UNKNOWN: '#888'};
  var author = jNode.querySelector('#author-text, #header-author');
  if (!author) return;
  if (author.querySelector('.mb-ai-badge')) return;
  var badge = document.createElement('span');
  badge.className = 'mb-ai-badge';
  badge.style.cssText = 'color: ' + (colors[channel.label] || '#888') + '; margin-left: 6px; font-weight: bold; cursor: help; font-size: 12px;';
  badge.textContent = '[' + channel.label + ']';
  badge.title = 'Confidence: ' + Math.round(channel.confidence * 100) + '%\nReason: ' + channel.reasoning;
  author.appendChild(badge);
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
  var apiKey = GM_getValue('deepseek_api_key');
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
    if (handleCache.has(tail)) return handleCache.get(tail);
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
        handleCache.set(tail, match[1]);
        return match[1];
      }
      // fallback: inline JSON
      var fallback = responseText.match(/"channelId":"(UC[^"]+)"/);
      if (fallback) {
        handleCache.set(tail, fallback[1]);
        return fallback[1];
      }
    } catch (e) {
      console.warn('[MetaBot] handle resolve failed for', tail, ':', e.message);
    }
    // cache negative to avoid repeated retries
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
      timeControl = setInterval(function() {
        waitForKeyElements(selectorTxt, actionFunction, bWaitOnce);
      }, 300);
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

  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.matches && node.matches('ytd-comment-thread-renderer, ytd-comment-view-model')) {
          try { parseitemNew(node); } catch (e) { console.warn('[MetaBot] observer parseitem failed:', e.message); }
        }
        // Process nested renderers inside loaded batch containers
        if (node.querySelectorAll) {
          var inner = node.querySelectorAll('ytd-comment-thread-renderer, ytd-comment-view-model');
          for (var k = 0; k < inner.length; k++) {
            try { parseitemNew(inner[k]); } catch (e) { console.warn('[MetaBot] observer nested failed:', e.message); }
          }
        }
      }
    }
  });
  observer.observe(comments, { childList: true, subtree: true });
  window._metabotObserver = observer;
  console.log('[MetaBot] MutationObserver attached to #comments');
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