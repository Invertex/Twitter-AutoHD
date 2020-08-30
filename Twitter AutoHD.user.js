// ==UserScript==
// @name         Twitter AutoHD
// @namespace    Invertex
// @version      0.25
// @description  Force videos to play highest quality and adds a download option.
// @author       Invertex
// @updateURL    https://github.com/Invertex/Twitter-AutoHD/raw/master/Twitter_AutoHD.user.js
// @downloadURL  https://github.com/Invertex/Twitter-AutoHD/raw/master/Twitter_AutoHD.user.js
// @icon         https://i.imgur.com/M9oO8K9.png
// @match        https://twitter.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @run-at document-start
// @require https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// ==/UserScript==

var requestUrl = 'https://www.savetweetvid.com/result?url=';
const modifiedAttr = "THD_modified";
const tweetQuery = 'div[data-testid="tweet"]';

var vids = new Map();

const argsChildAndSub = {attributes: false, childList: true, subtree: true};
const argsChildOnly = {attributes: false, childList: true, subtree: false};
const argsChildAndAttr = {attributes: true, childList: true, subtree: false};

const dlSVG = '<g><path d="M 8 51 C 5 54 5 48 5 42 L 5 -40 C 5 -45 -5 -45 -5 -40 V 42 C -5 48 -5 54 -8 51 L -48 15 C -51 12 -61 17 -56 22 L -12 61 C 0 71 0 71 12 61 L 56 22 C 61 17 52 11 48 15 Z"></path>' +
'<path d="M 56 -58 C 62 -58 62 -68 56 -68 H -56 C -62 -68 -62 -58 -56 -58 Z"></path></g>';

addGlobalStyle('@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }');
addGlobalStyle('.loader { border: 16px solid #f3f3f373; display: flex; margin: auto; border-top: 16px solid #3498db99; border-radius: 50%; width: 120px; height: 120px; animation: spin 2s linear infinite;}');

function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
}

//Intercept m3u8 playlist requests and modify the contents to only include the highest quality
(function(open)
 {
    XMLHttpRequest.prototype.open = function(method,url) {

        if(url.includes('video.twimg.com') && url.includes('.m3u8?tag='))
        {
            this.addEventListener('readystatechange', function(e)
            {
                if(this.readyState === 4)
                {
					var lines = e.target.responseText.split('#');
                    Object.defineProperty(this, 'response', {writable: true});
                    Object.defineProperty(this, 'responseText', {writable: true});
                    this.response = this.responseText = '#' + lines[1] + '#' + lines[lines.length - 1];
                }
            });
        }
        open.apply(this, arguments);
    };
})(XMLHttpRequest.prototype.open);

function download(url, filename)
{
    GM_download({
        name: filename,
        url: url,
        onload: function() { console.log(`Downloaded ${url}!`); }
    });
}

async function addDownloadButton(tweet, vidUrl)
{
    let filename = vidUrl.split('/').pop();
    let buttonGrp = tweet.closest('article[role="article"]').querySelector('div[role="group"]');
    let dlBtn = buttonGrp.lastChild.cloneNode(true);
    buttonGrp.appendChild(dlBtn);

    let svg = dlBtn.querySelector('svg');
    svg.innerHTML = dlSVG;
    svg.setAttribute('viewBox', "-80 -80 160 160");
    let iconDiv = dlBtn.querySelector('div[dir="ltr"]');
    let oldIconColor = $(iconDiv).css("color");
    let bg = iconDiv.firstElementChild.firstElementChild;
    let oldBGColor = $(bg).css("background-color");
    //Emulate Twitter hover color change
    $(dlBtn).hover(function(){
        $(bg).css("background-color", "#f3d60720");
        $(iconDiv).css("color", "#f3d607FF");
    },function(){
        $(bg).css("background-color", oldBGColor);
        $(iconDiv).css("color", oldIconColor);
    });

    let linkElem = $(dlBtn).wrapAll(`<a href="${vidUrl}" download="${filename}"></a>`);
    $(dlBtn.parentNode).addClass(dlBtn.className);
    $(linkElem).click(function(e){ e.preventDefault(); download(vidUrl, filename); });
}

async function replaceVideoElement(tweet)
{
    if(tweet != null)
    {
		let url = window.location.href;
		let link = tweet.closest('article[role="article"]').querySelector('a[role="link"][dir="auto"][title]');
		if(link != null){ url = link.href; }
        url = url.split('?')[0];

        let id = url.split('/').pop();
        let cachedVidUrl = vids.get(id);

        if(cachedVidUrl != null)
        {
            console.log(`used cached vid! : ${cachedVidUrl}`);
            addDownloadButton(tweet, cachedVidUrl);
            return;
        }

         function onLoad(response)
         {
                let xmlDoc = (new DOMParser()).parseFromString(response.responseText, "text/html");
                let qualityEntry = xmlDoc.querySelector('table.table tbody tr');
                if(qualityEntry == null) { return; } //Couldn't get a source URL. In future setup own dev account to handle this
                let vidUrl = qualityEntry.querySelector('a').href;
                if(vidUrl.includes("#")) { vidUrl = xmlDoc.querySelector('video#video source').src;}
                vidUrl = vidUrl.split('?')[0];
                vids.set(id, vidUrl);
                addDownloadButton(tweet, vidUrl);
          };

        GM_xmlhttpRequest({
            method: "GET",
            url: requestUrl + url,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "text/html"
            },
            responseType: "document",
            onload: onLoad
        });
    }
}

async function listenForMediaType(postRoot, tweet)
{
    if(tweet.hasAttribute(modifiedAttr)) { return; }
    tweet.setAttribute(modifiedAttr, "");

    if(postRoot.querySelector('div[role="blockquote"]') != null) { return; } //Can't get the source post from the blockquote HTML, have to use Twitter API eventually

    let tweetObserver = new MutationObserver(mediaExists);
    if(mediaExists()) { return; }

    function mediaExists()
    {
        if(tweet == null || (!onStatusPage() && tweet.querySelector('div[data-testid="placementTracking"]') == null)) { tweetObserver.disconnect(); return; } //If video, should have placementTracking after first mutation

        let video = tweet.querySelector('video');
        if(video != null) //is video
        {
            tweetObserver.disconnect();
            replaceVideoElement(tweet, video);
            return true;
        }
        return false;
    }

    tweetObserver.observe(tweet, argsChildAndSub);
}

function onTimelineChange(timeline)
{
     timeline.childNodes.forEach((child) => {
         if(!child.hasAttribute(modifiedAttr))
         {
             child.setAttribute(modifiedAttr, "");
             watchForElem(child, tweetQuery, true, argsChildAndSub, (child, tweet)=> { listenForMediaType(child, tweet); });
         }
     });
}

function watchForTimeline(main, timeline)
{
    let progBarObserver = new MutationObserver(
        function(mutations)
        {
            if(timeline.querySelector('[role="progressbar"]') == null)
            {
                progBarObserver.disconnect();
                let tl = timeline.querySelector('div');
                onTimelineChange(tl);
                watchForChange(tl, false, argsChildAndAttr, onTimelineChange);
            }
        });

    progBarObserver.observe(timeline, argsChildAndSub);
}

function onMainChange(main)
{
    if(onStatusPage()) { watchForElem(main, tweetQuery, true, argsChildAndSub, (root, tweet) => listenForMediaType(root, tweet.parentElement)); }
    else{watchForElem(main.querySelector('div[data-testid="primaryColumn"]'), 'section[role="region"] div', true, argsChildAndSub, watchForTimeline); }
}

async function watchForChange(root, stopAfterFirstMutation, obsArguments, executeAfter)
{
    let rootObserver = new MutationObserver(
        function(mutations)
        {
            if(stopAfterFirstMutation) { rootObserver.disconnect(); }
            executeAfter(root);
        });

    rootObserver.observe(root, obsArguments);
}

async function watchForElem(root, query, stopAfterFinding, obsArguments, executeAfter)
{
    let rootObserver = new MutationObserver(
        function(mutations)
        {
            var elem = root.querySelector(query);
            if(elem != null && elem != undefined)
            {
                //console.log(`Found element '${query}'!`);
                if(stopAfterFinding === true) { rootObserver.disconnect(); }
                executeAfter(root, elem);
            }
        });

    rootObserver.observe(root, obsArguments);
}

function onStatusPage() { return document.location.href.includes('/status/'); }

(function() {
    'use strict';
    watchForElem(document.querySelector('div#react-root'), 'main[role="main"] div', true, argsChildAndSub, (root, main)=>{
        onMainChange(main);
        watchForChange(main, false, argsChildOnly, onMainChange);
    });
})();