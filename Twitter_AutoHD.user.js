// ==UserScript==
// @name         Twitter AutoHD
// @namespace    Invertex
// @version      0.38
// @description  Force videos to play highest quality and adds a download option.
// @author       Invertex
// @updateURL    https://github.com/Invertex/Twitter-AutoHD/raw/master/Twitter_AutoHD.user.js
// @downloadURL  https://github.com/Invertex/Twitter-AutoHD/raw/master/Twitter_AutoHD.user.js
// @icon         https://i.imgur.com/M9oO8K9.png
// @match        https://*.twitter.com/*
// @match        https://*.twimg.com/media/*
// @connect      savetweetvid.com
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @run-at document-body
// @require https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// ==/UserScript==

const requestUrl = 'https://www.savetweetvid.com/result?url=';
const modifiedAttr = "THD_modified";
const tweetQuery = 'div[data-testid="tweet"]';

var vids = new Map(); //Cache download links for tweets we've already processed this session to reduce API timeout potential and speed-up button creation when the same media is loaded onto timeline again

const argsChildAndSub = {attributes: false, childList: true, subtree: true};
const argsChildOnly = {attributes: false, childList: true, subtree: false};
const argsChildAndAttr = {attributes: true, childList: true, subtree: false};

const dlSVG = '<g><path d="M 8 51 C 5 54 5 48 5 42 L 5 -40 C 5 -45 -5 -45 -5 -40 V 42 C -5 48 -5 54 -8 51 L -48 15 C -51 12 -61 17 -56 22 L -12 61 C 0 71 0 71 12 61 L 56 22 C 61 17 52 11 48 15 Z"></path>' +
'<path d="M 56 -58 C 62 -58 62 -68 56 -68 H -56 C -62 -68 -62 -58 -56 -58 Z"></path></g>';

addGlobalStyle('@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }');
addGlobalStyle('.loader { border: 16px solid #f3f3f373; display: flex; margin: auto; border-top: 16px solid #3498db99; border-radius: 50%; width: 120px; height: 120px; animation: spin 2s linear infinite;}');

function LogMessage(text) { /*console.log(text);*/ }

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
					let lines = e.target.responseText.split('#');
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
        onload: function() { LogMessage(`Downloaded ${url}!`); }
    });
}

async function addDownloadButton(tweet, vidUrl, username)
{
    let buttonGrp = tweet.closest('article[role="article"]')?.querySelector('div[role="group"]');
    if(buttonGrp == null || buttonGrp.querySelector('div#thd_dl') != null) { return; } //Button group doesn't exist or we already processed this element and added a DL button

    let filename = vidUrl.split('/').pop();
    filename = username + '_' + filename;

    let dlBtn = buttonGrp.lastChild.cloneNode(true);
    dlBtn.id = "thd_dl";
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

function addHasAttribute(elem, attr)
{
    if(elem.hasAttribute(attr)) { return true; }
    elem.setAttribute(attr, "");
    return false;
}

function getHighQualityImage(url)
{
    return url.replace(/(?<=[\&\?]name=)([A-Za-z0-9])+(?=\&)?/, 'orig');
}

function waitForImgLoad(img){
    return new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

function updateImgSrc (imgElem, bgElem, src)
{
    if(imgElem.src != src)
    {
        imgElem.src = src;
        bgElem.style.backgroundImage = `url("${src}")`;
    }
};

async function updateImageElement(imgLink, imgCnt)
{
    const imgContainer = await awaitElem(imgLink, 'div[aria-label="Image"]', argsChildAndSub);
    const img = await awaitElem(imgContainer, 'IMG', argsChildAndSub);
    const hqSrc = getHighQualityImage(img.src);
    const bg = imgContainer.querySelector('div[style^="background-image"]');
    LogMessage(imgLink);

    let naturalHeight = 0;
    let naturalWidth = 0;

    img.setAttribute(modifiedAttr, "");
    updateImgSrc(img, bg, hqSrc);
    doOnAttributeChange(img, (imgElem) => updateImgSrc(imgElem, bg, hqSrc));

    if(!img.complete || img.naturalHeight == 0) { await waitForImgLoad(img); }
    naturalHeight = img.naturalHeight; naturalWidth = img.naturalWidth;
/*
    if(imgCnt < 2)
    {
        imgContainer.removeAttribute("style");
        bg.style.backgroundSize = "contain";
        doOnAttributeChange(imgContainer, (container) => { container.removeAttribute("style");}, true )
    } else
    {
        imgContainer.removeAttribute("style");;
         doOnAttributeChange(imgContainer, (container) => { container.removeAttribute("style"); }, true )
       //  imgContainer.style.margin = "";
    }
*/
    if(imgCnt < 3) { bg.style.backgroundSize = "contain"; }
    if(imgCnt < 2)
    {
        imgContainer.removeAttribute('style');
        doOnAttributeChange(imgContainer, (container) => {container.removeAttribute('style');}, true );
    }
    else
    {
        imgContainer.style.marginLeft = "0%";
         imgContainer.style.marginRight = "0%";
         imgContainer.style.marginTop = "0%";
         doOnAttributeChange(imgContainer, (container) =>{
             container.style.marginLeft = "0%";
             container.style.marginRight = "0%";
              container.style.marginTop = "0%";
         }, true);
    }
    let flexDir = $(imgLink.parentElement).css('flex-direction');
    return {imgElem: img, bgElem: bg, layoutContainer: imgLink.parentElement, width: img.naturalWidth, height: img.naturalHeight, flex: flexDir};
}

async function updateImageElements(tweet, imgLinks)
{

    if(tweet != null && imgLinks != null && !addHasAttribute(tweet, modifiedAttr))
    {
        let imgCnt = imgLinks.length;
        if(imgCnt == 0) { return; }
        let padder = imgLinks[0].parentElement.parentElement.parentElement.parentElement.parentElement.querySelector('div[style^="padding-bottom"]');

        const images = [];

        for(let link = 0; link < imgCnt; link++)
        {
            let imgData = await updateImageElement(imgLinks[link], imgCnt);
            images.push(imgData);
        }
       imgCnt = images.length;
        LogMessage(imgCnt);
        let ratio = 100;

        if(imgCnt == 1 || (imgCnt == 2 && images[0].flex == "column"))
        {
            ratio = (images[0].height / images[0].width) * 100;
            LogMessage("flex column: +" + imgCnt);
        }
        else if(imgCnt == 2 && images[0].flex == "row")
        {
            let img1 = images[0]; let img2 = images[1];
            ratio = img1.height / (img1.width);
            ratio *= 100;
            ratio *= 0.5;
            img1.bgElem.style.backgroundSize = "contain";
            img2.bgElem.style.backgroundSize = "cover";
            img1.layoutContainer.removeAttribute("style");
            img2.layoutContainer.removeAttribute("style");
        }
        else if(imgCnt == 3 && images[0].flex == "row")
        {
            let img1 = images[0];
            let img1Ratio = img1.height / img1.width;
            if(img1Ratio < 1.10 && img1Ratio > 0.9){ img1.bgElem.style.backgroundSize = "contain"; }
        }
        else if(imgCnt == 4)
        {
            if(images[0].width > images[0].height
               && images[1].width > images[1].height
               && images[2].width > images[2].height
               && images[3].width > images[3].height) { return; } //All-wide 4-panel already has an optimal layout by default.
        }

        padder.style = `padding-bottom: ${ratio}%;`;
        padder.setAttribute("modifiedPadding","");
        doOnAttributeChange(padder, (padderElem) => { padderElem.style = "padding-bottom: " + ratio + "%;";} )
        LogMessage(padder);
        LogMessage(ratio);
    }
}

async function replaceVideoElement(tweet)
{
    if(tweet != null && !addHasAttribute(tweet, modifiedAttr))
    {
		let url = window.location.href;
		let link = tweet.closest('article')?.querySelector('a[role="link"][dir="auto"]');
        if(link == null) { return; }

		url = link.href;
        url = url.split('?')[0];

        let id = url.split('/').pop();
        let username = url.split('/status/')[0].split('/').pop();
        let cachedVidUrl = vids.get(id);

        if(cachedVidUrl != null)
        {
         //   LogMessage(`used cached vid! : ${cachedVidUrl}`);
            addDownloadButton(tweet, cachedVidUrl, username);
            return true;
        }

         function onLoad(response)
         {
             let xmlDoc = (new DOMParser()).parseFromString(response.response, "text/html");
             let qualityEntry = xmlDoc.querySelector('table.table tbody tr');

              //  let xmlDoc = (new DOMParser()).parseFromString(response.responseText, "text");
             //   let qualityEntry = xmlDoc.querySelector('table.table tbody tr');
                if(qualityEntry == null) { return; } //Couldn't get a source URL. In future setup own dev account to handle this
                let vidUrl = qualityEntry.querySelector('td a').href;
                if(vidUrl.includes("#")) {

                    vidUrl = xmlDoc.querySelector('video#video source').src;}
                vidUrl = vidUrl.split('?')[0];
                vids.set(id, vidUrl);
                addDownloadButton(tweet, vidUrl, username);
          };

        GM_xmlhttpRequest({
            method: "GET",
            url: requestUrl + url,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "text/html"
            },
           // overrideMimeType: "application/xml; charset=ISO-8859-1",
           // responseType: "document",
            onload: onLoad
        });
        return true;
    } else { return false; }
}

function mediaExists(tweet, tweetObserver)
{
    if(tweet == null || tweet.hasAttribute(modifiedAttr) /*|| (!onStatusPage() && tweet.querySelector('div[data-testid="placementTracking"]') == null)*/) { return false; } //If video, should have placementTracking after first mutation
   // LogMessage("media exists");

    let video = tweet.querySelector('video');
    if(video != null) //is video
    {
        tweetObserver.disconnect();
        replaceVideoElement(tweet, video)
        return true;
    }

    const allLinks = Array.from(tweet.querySelectorAll('a'));
    const imgLinks = [];
    allLinks.forEach((imgLink) =>
    {
        if(imgLink.href.includes('/photo/') && imgLink.closest('div[tabindex][role="link"]') == null/* && imgLink.querySelector('div[data-testid="tweetPhoto"]') != null*/)
        {
            imgLinks.push(imgLink);
        }
    });

    if(imgLinks.length > 0)
    {
        tweetObserver.disconnect();
        updateImageElements(tweet, imgLinks);
        return true;
    }
    return false;
}

async function listenForMediaType(article, tweet)
{
    if(addHasAttribute(tweet, "thdObserver")) { return; }

  //  if(postRoot.querySelector('div[role="blockquote"]') != null) { LogMessage("bq"); return; } //Can't get the source post from the blockquote HTML, have to use Twitter API eventually

    let tweetObserver = new MutationObserver((muteList, observer) => { mediaExists(tweet, observer); });
    if(mediaExists(tweet, tweetObserver)) { return; }
    tweetObserver.observe(tweet, argsChildAndSub);
}

function onTimelineChange(addedNodes)
{
    addedNodes.forEach((child) =>
    {
        if(addHasAttribute(child, modifiedAttr)) { return; }

        awaitElem(child, 'ARTICLE', argsChildAndSub)
            .then(article => awaitElem(article, tweetQuery, argsChildAndSub)
                  .then(tweet => { listenForMediaType(article, tweet); }));
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

                let tl = timeline.querySelector("DIV");
                tl.setAttribute('timeline', "");
                let childNodes = Array.from(tl.childNodes);
                onTimelineChange(childNodes);

                watchForAddedNodes(tl, false, argsChildAndSub, onTimelineChange);
            }
        });

    progBarObserver.observe(timeline, argsChildAndSub);
}


async function watchForAddedNodes(root, stopAfterFirstMutation, obsArguments, executeAfter)
{
    let rootObserver = new MutationObserver(
        function(mutations)
        {
            mutations.forEach(function(mutation) {
                if(mutation.addedNodes == null || mutation.addedNodes.length == 0) { return; }
                if(stopAfterFirstMutation) { rootObserver.disconnect(); }
                executeAfter(mutation.addedNodes);
            });

        });

    rootObserver.observe(root, obsArguments);
}

function findElem(rootElem, query, observer, resolve)
{
    const elem = rootElem.querySelector(query);
    if(elem != null && elem != undefined)
    {
        resolve(elem);
        observer?.disconnect();
    }
    return elem;
}

async function awaitElem(root, query, obsArguments)
{
     return new Promise((resolve, reject) =>
     {
         if(findElem(root, query, null, resolve)) { return; }
         let rootObserver = new MutationObserver((mutes, obs) => { findElem(root, query, obs, resolve); } );
         rootObserver.observe(root, obsArguments);
    });
}

function doOnAttributeChange(elem, onChange, repeatOnce = false)
{
      let rootObserver = new MutationObserver((mutes, obvs) => {
          obvs.disconnect();
          onChange(elem);
          if(repeatOnce == true) { return; }
          obvs.observe(elem, {childList: false, subtree: false, attributes: true})
      });
    rootObserver.observe(elem, {childList: false, subtree: false, attributes: true});
}


function onStatusPage() { return document.location.href.includes('/status/'); }

function onMainChange(main, mutations)
{
    let primaryColumn = main.querySelector('div[data-testid="primaryColumn"]');
    if(primaryColumn != null)
    {
        if(addHasAttribute(primaryColumn, modifiedAttr)) { return; }
        awaitElem(primaryColumn, 'section[role="region"] > div', argsChildAndSub).then((section) => { watchForTimeline(primaryColumn, section); });

    } else if(onStatusPage())
    {
        awaitElem(main, tweetQuery, argsChildAndSub).then((tweet) => { listenForMediaType(main, tweet.parentElement); });
    }
}

async function updateFullViewImage(img)
{
    let bg = img.parentElement.querySelector('div');
    let hqSrc = getHighQualityImage(img.src);
    updateImgSrc(img, bg, hqSrc);
    doOnAttributeChange(img, (imgElem) => {updateImgSrc(imgElem, bg, hqSrc);}, false);
}

async function onLayersChange(layers, mutation)
{
    if(mutation.addedNodes != null && mutation.addedNodes.length > 0)
    {
        let addedElems = Array.from(mutation.addedNodes);
        let dialog = await awaitElem(addedElems[0], 'div[role="dialog"]', argsChildAndSub);
        let img = await awaitElem(dialog, 'img[alt="Image"]', argsChildAndSub);
        let list = dialog.querySelector('ul[role="list"]');

        if(list != null)
        {
            let listItems = list.querySelectorAll('li');

            listItems.forEach((panel) => {
                awaitElem(panel, 'img[alt="Image"]', argsChildAndSub)
                    .then((img) => updateFullViewImage(img)); });
        }
        else { updateFullViewImage(img); }
    }
}

async function watchForChange(root, obsArguments, onChange)
{
    let rootObserver = new MutationObserver(function(mutations) {
        mutations.forEach((mutation) => onChange(root, mutation));
    });
    rootObserver.observe(root, obsArguments);
}

function checkIfFileUrl(url)
{
    if(url.includes('/media/') && url.includes('format=') && url.includes('name='))
    {
        if(!url.includes('name=orig'))
        {
            let hqUrl = getHighQualityImage(url);
            window.location.href = getHighQualityImage(url);
        }
        return true;
    }
    return false;
}

(async function() {
    'use strict';
    if(checkIfFileUrl(window.location.href)) { return; }

    NodeList.prototype.forEach = Array.prototype.forEach;
    let reactRoot = document.querySelector('div#react-root');
    const main = await awaitElem(reactRoot, 'main[role="main"] div', argsChildAndSub);
    awaitElem(reactRoot, 'div#layers', argsChildAndSub).then((layers) => { watchForChange(layers, argsChildOnly, onLayersChange); });
    onMainChange(main);
    watchForChange(main, argsChildOnly, onMainChange);
})();
