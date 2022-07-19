// ==UserScript==
// @name         Twitter AutoHD
// @namespace    Invertex
// @version      1.54
// @description  Forces whole image to show on timeline with bigger layout for multi-image. Forces videos/images to show in highest quality and adds a download button and right-click for images that ensures an organized filename.
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
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant GM_setValue
// @grant GM_getValue
// @grant GM.setValue
// @grant GM.getValue
// @run-at document-start
// @require https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// ==/UserScript==

const cooky = getCookie("ct0"); //Get our current Twitter session token so we can use Twitter API to request higher quality content
const requestUrl = 'https://www.savetweetvid.com/result?url='; //Backup option if Twitter API fails
const modifiedAttr = "THD_modified";
const tweetQuery = 'div[data-testid="tweet"]';
const GM_OpenInTabMissing = (typeof GM_openInTab === 'undefined');

var vids = new Map(); //Cache download links for tweets we've already processed this session to reduce API timeout potential and speed-up button creation when the same media is loaded onto timeline again
///
const argsChildAndSub = {attributes: false, childList: true, subtree: true};
const argsChildOnly = {attributes: false, childList: true, subtree: false};
const argsChildAndAttr = {attributes: true, childList: true, subtree: false};

const dlSVG = '<g><path d="M 8 51 C 5 54 5 48 5 42 L 5 -40 C 5 -45 -5 -45 -5 -40 V 42 C -5 48 -5 54 -8 51 L -48 15 C -51 12 -61 17 -56 22 L -12 61 C 0 71 0 71 12 61 L 56 22 C 61 17 52 11 48 15 Z"></path>' +
'<path d="M 56 -58 C 62 -58 62 -68 56 -68 H -56 C -62 -68 -62 -58 -56 -58 Z"></path></g>';

addGlobalStyle('@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }');
addGlobalStyle('.loader { border: 16px solid #f3f3f373; display: flex; margin: auto; border-top: 16px solid #3498db99; border-radius: 50%; width: 120px; height: 120px; animation: spin 2s linear infinite;}');

addGlobalStyle('.context-menu { position: absolute; text-align: center; margin: 0px; background: #040404; border: 1px solid #0e0e0e; border-radius: 5px;}');
addGlobalStyle('.context-menu ul { padding: 0px; margin: 0px; min-width: 190px; list-style: none;}');
addGlobalStyle('.context-menu ul li { padding-bottom: 7px; padding-top: 7px; border: 1px solid #0e0e0e; color:#c1bcbc; font-family: sans-serif; user-select: none;}');
addGlobalStyle('.context-menu ul li:hover { background: #202020;}');

//<--> Save/Load User Cutom Layout Width <-->//
const usePref_MainWidthKey = "thd_primaryWidth";
const usePref_hideTrendingKey = "thd_hideTrending";
const usePref_blurNSFW = "thd_blurNSFW";
//Greasemonkey does not have this functionality, so helpful way to check which function to use
const isGM = (typeof GM_addValueChangeListener === 'undefined');


//<--> TWEET PROCESSING <-->//
function StringBuilder(value) {
    this.strings = new Array();
    this.append(value);
}
StringBuilder.prototype.append = function(value) {
    if (value) {
        this.strings.push(value);
    }
}
StringBuilder.prototype.clear = function() {
    this.strings.length = 0;
}
StringBuilder.prototype.toString = function() {
    return this.strings.join("");
}

const sb = new StringBuilder("");

const BuildM3U = function(lines)
{
    const regex = /,BANDWIDTH=(.*),RESOLUTION/gm;

    let bestLine = 0;
    let bestBandwidth = 0;
    sb.append(lines[0]);

    for(let i = 1; i < lines.length; i++)
    {
        if(!lines[i].includes('STREAM-INF:')) { sb.append('#' + lines[i]); }
        else
        {
            let bandwidth = parseInt(regex.exec(lines[i]));
            if(bandwidth > bestBandwidth)
            {
                bestBandwidth = bandwidth;
                bestLine = i;
            } else if (bestLine === 0) { bestLine = i; } //failsafe in case something breaks with parsing down the line
        }
    }

    sb.append('#' + lines[bestLine]);
    let m3u = sb.toString();
    sb.clear();

    return m3u;
};

//Intercept m3u8 playlist requests and modify the contents to only include the highest quality
(function(open)
 {
    XMLHttpRequest.prototype.open = function(method,url)
    {
        if(url.includes('video.twimg.com') && url.includes('.m3u8?tag='))
        {
            this.addEventListener('readystatechange', function(e)
            {
                if(this.readyState === 4)
                {
					const lines = e.target.responseText.split('#');
                    const m3u = BuildM3U(lines);
                    Object.defineProperty(this, 'response', {writable: true});
                    Object.defineProperty(this, 'responseText', {writable: true});
                    this.response = this.responseText = m3u;
                }
            });
        }
        open.apply(this, arguments);
    };
})(XMLHttpRequest.prototype.open);

async function addDownloadButton(tweet, vidUrl, tweetInfo)
{
    let getButtonToDupe = function(btnGrp) {return buttonGrp.lastChild.cloneNode(true); };
    let isIframe = false;

    let buttonGrp = tweet.closest('article[role="article"]')?.querySelector('div[role="group"][id^="id__"]');
    if(buttonGrp == null) //Try iframe version
    {
        buttonGrp = tweet.querySelector('div a[href*="like?"]')?.parentElement;
        if(buttonGrp != null) {
            isIframe = true;
            getButtonToDupe = function(btnGrp) {
                return buttonGrp.querySelector('a:nth-child(2)').cloneNode(true);
            };
        }
    }
    if(buttonGrp == null || buttonGrp.querySelector('div#thd_dl') != null) { return; } //Button group doesn't exist or we already processed this element and added a DL button

    const filename = filenameFromTweetInfo(tweetInfo);
    const dlBtn = getButtonToDupe(buttonGrp);

    dlBtn.id = "thd_dl";
    buttonGrp.appendChild(dlBtn);
    dlBtn.href = vidUrl;

    const svg = dlBtn.querySelector('svg');
    svg.innerHTML = dlSVG;
    svg.setAttribute('viewBox', "-80 -80 160 160");

    const iconDiv = isIframe ? dlBtn.querySelector('div[dir="auto"]') : dlBtn.querySelector('div[dir="ltr"]');
    const bg = isIframe ? svg.parentElement : iconDiv.firstElementChild.firstElementChild;
    const linkElem = isIframe ? dlBtn : $(dlBtn).wrapAll(`<a href="${vidUrl}" download="${filename}"></a>`);

    const oldBGColor = $(bg).css("background-color");
    const oldIconColor = $(iconDiv).css("color");
    //Emulate Twitter hover color change
    $(dlBtn).hover(function(){
        $(bg).css("background-color", "#f3d60720");
         $(bg).css("border-radius", "20px");
        $(svg).css("color", "#f3d607FF");
    },function(){
        $(bg).css("background-color", oldBGColor);
        $(svg).css("color", oldIconColor);
    });

    if(isIframe)
    {
        linkElem.setAttribute('download', filename);
        dlBtn.querySelector('div[dir="auto"] > span').innerText = "Download";
    }
    $(dlBtn.parentNode).addClass(dlBtn.className);
    $(linkElem).click(function(e){ e.preventDefault(); e.stopPropagation(); download(vidUrl, filename); });
}

function waitForImgLoad(img){
    return new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

function updateImgSrc(imgElem, bgElem, src)
{
    if(imgElem.src != src)
    {
        imgElem.src = src;
        bgElem.style.backgroundImage = `url("${src}")`;
    }
};

async function updateImageElement(tweetInfo, imgLink, imgCnt)
{
    const imgContainer = await awaitElem(imgLink, 'div[aria-label="Image"], div[data-testid="tweetPhoto"]', argsChildAndSub);
    const img = await awaitElem(imgContainer, 'IMG', argsChildAndSub);
    const hqSrc = getHighQualityImage(img.src);

    const bg = imgContainer.querySelector('div[style^="background-image"]');
   // LogMessage(imgLink);

    addCustomCtxMenu(imgLink, hqSrc, tweetInfo, img);
    img.setAttribute(modifiedAttr, "");

    let naturalHeight = 0;
    let naturalWidth = 0;

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
    const updatePadding = function(panelCnt, background, imgContainerElem)
    {
        if(panelCnt != 3)
        {
            background.style.backgroundSize = "cover";
            //imgContainerElem.style.marginBottom = "0%";
        }
        if(panelCnt < 2)
        {
            imgContainerElem.removeAttribute('style');
        }
        else
        {
            imgContainerElem.style.marginLeft = "0%";
            imgContainerElem.style.marginRight = "0%";
            imgContainerElem.style.marginTop = "0%";
        }
    };

    updatePadding(imgCnt, bg, imgContainer);
    doOnAttributeChange(imgContainer, (container) => updatePadding(imgCnt, bg, container), true );

    const flexDir = $(imgLink.parentElement).css('flex-direction');
    return {imgElem: img, bgElem: bg, layoutContainer: imgLink.parentElement, width: img.naturalWidth, height: img.naturalHeight, flex: flexDir, hqSrc: hqSrc};
}

async function updateImageElements(tweet, imgLinks)
{
    if(tweet != null && imgLinks != null)
    {
        let imgCnt = imgLinks.length;
        if(imgCnt == 0) { return; }

        if(addHasAttribute(imgLinks[0], modifiedAttr)) { return; }

        let tweetInfo = getTweetInfo(tweet);

        processBlurButton(tweet);

        const padder = await awaitElem(imgLinks[0].parentElement.parentElement.parentElement.parentElement.parentElement, 'div[style^="padding-bottom"]');
        padder.parentElement.style = ""; //Get rid of static content size values

        const flexer = padder.closest('div[id^="id_"] > div').style = "align-self:normal; !important"; //Counteract Twitter's new variable width display of content that is rather wasteful of screenspace

        const images = [];

        for(let link = 0; link < imgCnt; link++)
        {
            if(imgCnt > 1)
            {
                tweetInfo = { ...tweetInfo }; //Shallow copy to avoid changing the data for another image
                tweetInfo.elemIndex = link + 1; //Set our element index so we can add it to our filename later to differentiate the multi-images of a post ID
            }
            let imgData = await updateImageElement(tweetInfo, imgLinks[link], imgCnt);
            images.push(imgData);
        }

        imgCnt = images.length;
        let ratio = 100;

        if(imgCnt > 0)
        {
            ratio = (images[0].height / images[0].width) * 100;
        }
        if(imgCnt == 2)
        {
            let img1 = images[0]; let img2 = images[1];
            let img1Ratio = img1.height / img1.width;
            let img2Ratio = img2.height / img2.width;
            var imgToRatio = img1Ratio > img2Ratio ? img1 : img2;
            ratio = (imgToRatio.height / imgToRatio.width);

            img1.bgElem.style.backgroundSize = "cover";
            img2.bgElem.style.backgroundSize = "cover";
            img1.layoutContainer.removeAttribute("style");
            img2.layoutContainer.removeAttribute("style");

            if(img1.flex == "row")
            {
                if(imgToRatio.height > imgToRatio.width)
                {
                     ratio *= 0.5;
                }
            }
            else
            {
               //if(ratio > 1.0) {   ratio = ((ratio - 1.0) * 0.5) + 1.0;}
                ratio *= 0.5;
            }

            ratio = Math.min(ratio, 3.0);
            ratio = ratio * 100;
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
               && images[3].width > images[3].height){
            } //All-wide 4-panel already has an optimal layout by default.
            else if(images[0].width > images[0].height)
            {
                // ratio = 100;
                let img1Ratio = images[0].height / images[0].width;
                let img2Ratio = images[1].height / images[1].width;
                let img3Ratio = images[2].height / images[2].width;
                let img4Ratio = images[3].height / images[3].width;
                let minImg = img1Ratio > img2Ratio ? images[1] : images[0];

                ratio = (images[0].height + images[1].height) / minImg.width;
                ratio *= 100;
            }
        }

        padder.style = `padding-bottom: ${ratio}%; padding-top: 0px;`;
        padder.setAttribute("modifiedPadding","");

        for(let i = 0; i < imgCnt; i++)
        {
            let curImg = images[i];
            updateImgSrc(curImg, curImg.bgElem, curImg.hqSrc);
            doOnAttributeChange(curImg.layoutContainer, () => { updateImgSrc(curImg, curImg.bgElem, curImg.hqSrc) });
        }

        //Annoying Edge....edge-case. Have to find this random class name generated element and remove its align so that elements will expand fully into the feed column
        var edgeCase = getCSSRuleContainingStyle('align-self', ['.r-'], 0, 'flex-start');
        if(edgeCase != null)
        {
            edgeCase.style.setProperty('align-self', "inherit");
        }
        doOnAttributeChange(padder, (padderElem) => { padderElem.style = "padding-bottom: " + ratio + "%;";} )
        doOnAttributeChange(padder.parentElement, (padderParentElem) => { padderParentElem.style = "";} )
    }
}

function onLoadVideo (xmlDoc, tweetElem, tweetInfo)
{
    const qualityEntry = xmlDoc.querySelector('table.table tbody tr'); //First quality entry will be highest
    if(qualityEntry == null) { return; } //Couldn't get a source URL. In future setup own dev account to handle this
    let vidUrl = qualityEntry.querySelector('td a').href;
    if(vidUrl.includes("#")) { vidUrl = xmlDoc.querySelector('video#video source').src; }
    vidUrl = vidUrl.split('?')[0];
    vids.set(tweetInfo.id, vidUrl);
//    LogMessage("cache vid: " + tweetInfo.id + ":" + vidUrl);
    addDownloadButton(tweetElem, vidUrl, tweetInfo);
};

async function onPlayButtonChange(vid, playContainer)
{
    let tabIndex = playContainer.querySelector('div[tabindex="0"]');
    if(tabIndex)
    {
        let spanner = tabIndex.querySelector('div[dir="auto"] > span > span');
        if(spanner && spanner.innerText == "GIF")
        {
            tabIndex.remove();
            vid.onmouseover = function() {
                vid.setAttribute('controls', "");
            };
            vid.onmouseleave = function() {
                if(!vid.paused) { vid.removeAttribute('controls'); }
            };

        } else {/* console.log(" no spanner found");*/ }
    }
}

async function watchPlayButton(vidElem)
{
    let playContainer = vidElem.parentElement.parentElement.parentElement;
    let gifPlayBtn = playContainer.querySelector('div[tabindex="0"][role="button"]');

    if(gifPlayBtn)
    {
        watchForChange(playContainer, {attributes: true, childList: true, subtree: true}, (playBtn, mutes) => { onPlayButtonChange(vidElem, playContainer);} );
    }
}

async function replaceVideoElement(tweet, vidElem)
{
    if(tweet == null) { return false; }

    const tweetInfo = getTweetInfo(tweet);
    if(tweetInfo == null) { return false; }

    watchPlayButton(vidElem);

    if(vidElem.src.includes('/tweet_video/'))
    {
  //      LogMessage(`Is a GIF, used local src! : ${vidElem.src} id: ${tweetInfo.id} url: ${tweetInfo.url} username: ${tweetInfo.username}`);
        addDownloadButton(tweet, vidElem.src, tweetInfo);
        return true;
    }

    const cachedVidUrl = vids.get(tweetInfo.id);

    if(cachedVidUrl)
    {
    //    LogMessage(`used cached vid! : ${cachedVidUrl} id: ${tweetInfo.id} url: ${tweetInfo.url} username: ${tweetInfo.username}`);
        addDownloadButton(tweet, cachedVidUrl, tweetInfo);
        return true;
    }

    try
    {
        const vidUrl = await getVidURL(tweetInfo.id);
        if(vidUrl != null) //Was able to grab URL using legacy Twitter API and user token
        {
            //    LogMessage(`found vid! : ${vidUrl} id: ${tweetInfo.id} url: ${tweetInfo.url} username: ${tweetInfo.username}`);
            addDownloadButton(tweet, vidUrl, tweetInfo);
            return true;
        }
    } catch(_){}

    //Previous methods failed, use an external service for grabbing the video.
    GM_xmlhttpRequest({
        method: "GET",
        url: requestUrl + tweetInfo.url,
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html"
        },
        // overrideMimeType: "application/xml; charset=ISO-8859-1",
        // responseType: "document",
        onload: function(response){ onLoadVideo((new DOMParser()).parseFromString(response.response, "text/html"), tweet, tweetInfo); }
    });

    vids.set(tweetInfo.id, '');
    return true;
}

function mediaExists(tweet, tweetObserver)
{

    if(tweet == null /*|| (!isOStatusPage() && tweet.querySelector('div[data-testid="placementTracking"]') == null)*/) { return false; } //If video, should have placementTracking after first mutation
    if(tweet.querySelector(`[${modifiedAttr}]`)) { return true; }
    let video = tweet.querySelector('video');

    if(video != null) //is video
    {
        processBlurButton(tweet);

        if(replaceVideoElement(tweet, video))
        {
            tweetObserver?.disconnect();
            addHasAttribute(video, modifiedAttr);
            return true;
        }
        return false;
    }

    const allLinks = Array.from(tweet.querySelectorAll('a'));
    const imgLinks = [];
    const quoteImgLinks = [];

    allLinks.forEach((imgLink) =>
    {
        let href = imgLink.href;
        if(href.includes('/photo/') /*&& imgLink.closest('div[tabindex][role="link"]') == null && imgLink.querySelector('div[data-testid="tweetPhoto"]') != null*/)
        {
            if(imgLink.closest('div[tabindex][role="link"]') != null) { quoteImgLinks.push(imgLink); }
            else { imgLinks.push(imgLink); }
        }
     /*   else if(href.includes('t.co/')) //External website link
        {
            let img = imgLink.querySelector('img[src*="/card_img/"]');
            if(img) { quoteImgLinks.push(imgLink); LogMessage("Found card imag");}
        }*/
    });

    let foundImages = false;

    if(imgLinks.length > 0)
    {
      //  tweetObserver.disconnect();
        updateImageElements(tweet, imgLinks);
        foundImages = true;
    }
    if(quoteImgLinks.length > 0)
    {
      //  tweetObserver.disconnect();
        updateImageElements(tweet, quoteImgLinks);
        foundImages = true;
    }
    if(foundImages) { addHasAttribute(tweet, modifiedAttr); }
    return foundImages;
}

async function listenForMediaType(tweet)
{
    if(addHasAttribute(tweet, "thd_observing")) { return; }

  //  if(postRoot.querySelector('div[role="blockquote"]') != null) { LogMessage("bq"); return; } //Can't get the source post from the blockquote HTML, have to use Twitter API eventually
    const tweetObserver = new MutationObserver((muteList, observer) => { mediaExists(tweet, observer); });
    mediaExists(tweet, tweetObserver);
    tweetObserver.observe(tweet, {attributes: true, childList: true, subtree: true});
}

//<--> TIMELINE PROCESSING <-->//

var primaryColumnCursorDistToEdge = 900;
var primaryColumnMouseDownPos = 0;
var primaryColumnResizing = false;
var primaryColumnPreWidth = 600;
var maxWidthClass = null;
var preCursor = document.body.style.cursor;
var headerColumn = null;

function primaryColumnResizer(primaryColumn, mouseEvent, mouseDown, mouseUp)
{
    let primaryRect = primaryColumn.getBoundingClientRect();
    let localPosX = mouseEvent.clientX - primaryRect.left;
    primaryColumnCursorDistToEdge = Math.abs(primaryRect.width - localPosX);

    if(mouseUp || primaryColumnCursorDistToEdge > 180){
        primaryColumnResizing = false;
        if(mouseUp)
        {
            let primarySize = parseInt(maxWidthClass.style.getPropertyValue('max-width'));
            updateLayoutWidth(primarySize, true);
        }
    };
    if(primaryColumnCursorDistToEdge < 6 || primaryColumnResizing)
    {
        preCursor = document.body.style.cursor;
        document.body.style.cursor = "ew-resize";
        if(mouseDown)
        {
            primaryColumnMouseDownPos = mouseEvent.pageX;
            primaryColumnResizing = true;
            primaryColumnPreWidth = parseInt(maxWidthClass.style.getPropertyValue('max-width'));
        }
    }
    else
    {
         document.body.style.cursor = (preCursor == "ew-resize") ? "auto" : preCursor;
    }
    if(primaryColumnResizing)
    {
        mouseEvent.preventDefault();
        let columnOffset = mouseEvent.pageX - primaryColumnMouseDownPos;
        let newColumnSize = primaryColumnPreWidth + columnOffset;
        newColumnSize = Math.max(250, newColumnSize);
        updateLayoutWidth(newColumnSize);
    }
}

function updateLayoutWidth(width, finalize)
{
    maxWidthClass.style.setProperty('max-width', width + "px");
    if(finalize)
    {
        headerColumn = document.body.querySelector('HEADER');
        let flexGrow = 600 / width;
        flexGrow *= flexGrow;
        headerColumn.style.flexGrow = (width >= 600) ? flexGrow : 1;
        setUserPref(usePref_MainWidthKey, width);
    }
}

async function onTimelineContainerChange(container, mutations)
{
    LogMessage("on timeline container change");
    let tl = await awaitElem(container, 'DIV[style*="position:"]', {childList: true, subtree: true, attributes: true});
    observeTimeline(tl);
}

function onTimelineChange(addedNodes)
{
    //LogMessage("on timeline change");
    if(addedNodes.length == 0 ) { LogMessage("no added nodes"); return; }
    addedNodes.forEach((child) =>
                       {
        //   if(addHasAttribute(child, modifiedAttr)) { return; }
        awaitElem(child, 'ARTICLE', argsChildAndSub).then(listenForMediaType);
        //  awaitElem(child, 'ARTICLE,ARTICLE '+ tweetQuery, argsChildAndSub).then(tweet => { listenForMediaType(tweet.parentElement); })
    });
}

function observeTimeline(tl)
{
    if(!addHasAttribute(tl, "thd_observing_timeline"))
    {
        LogMessage("starting timeline observation");
        const childNodes = Array.from(tl.childNodes);
        onTimelineChange(childNodes);

        watchForAddedNodes(tl, false, {attributes: false, childList: true, subtree: false}, onTimelineChange);
    }
}

async function watchForTimeline(primaryColumn, section)
{
    const checkTimeline = async function()
    {
        let tl = await awaitElem(section, 'DIV[style*="position:"]', {childList: true, subtree: true, attributes: true});
        let progBar = tl.querySelector('[role="progressbar"]');
        if(progBar)
        {
            // Wait for an Article to show up before proceeding
            LogMessage("Has Prog Bar, Awaiting Article");
            let art = await awaitElem(section, "article", {childList: true, subtree: true, attributes: true});
            LogMessage("Found Article");
        }

        let tlContainer = tl.parentElement;
        if(!addHasAttribute(tlContainer, "thd_observing_timeline"))
        {
            observeTimeline(tl);
            watchForChange(tlContainer, {attributes: false, childList: true}, (tlc, mutes) => { onTimelineContainerChange(tlc, mutes);} );
        }

    };

    checkTimeline();

    let progBarObserver = new MutationObserver((mutations) => {checkTimeline();});
    progBarObserver.observe(section, {attributes: false, childList: true});
}

async function onMainChange(main, mutations)
{
    awaitElem(main, 'div[data-testid="primaryColumn"]', argsChildAndSub).then((primaryColumn) =>
    {
        if(addHasAttribute(primaryColumn, modifiedAttr)) { return; }
        var pageWidthLayoutRule = getCSSRuleContainingStyle('width', (("." + main.className).replace(' ', ' .')).split(' '));
        pageWidthLayoutRule.style.setProperty('width', "100%");

        let primaryColumnGrp = primaryColumn.parentElement.parentElement;
        let columnClassNames = ("." + primaryColumn.className.replace(" ", " .")).split(' ');

        maxWidthClass = getCSSRuleContainingStyle("max-width", columnClassNames);
        getUserPref(usePref_MainWidthKey, 600).then((userWidth) => updateLayoutWidth(userWidth, true));

        primaryColumnGrp.addEventListener('mousemove', (e) => { primaryColumnResizer(primaryColumn, e, false, false) });
        primaryColumnGrp.addEventListener('mousedown', (e) => { primaryColumnResizer(primaryColumn, e, true, false) });
        window.addEventListener('mouseup', (e) => { primaryColumnResizer(primaryColumn, e, false, true) });
        document.addEventListener('mouseup', (e) => { primaryColumnResizer(primaryColumn, e, false, true) });
      //  let section = awaitElem(primaryColumn, 'section[role="region"]', argsChildAndSub);
        awaitElem(primaryColumn, 'section[role="region"]', argsChildAndSub).then((section) => { LogMessage("region found"); watchForTimeline(primaryColumn, section); });
    });
    awaitElem(main, 'div[data-testid="sidebarColumn"]', argsChildAndSub).then((sideBar) => {

        awaitElem(sideBar, 'section[role="region"] > [role="heading"]', argsChildAndSub).then((sideBarTrending) => {
            setupTrendingControls(sideBarTrending.parentElement);
            setupNSFWToggle(sideBar);
        });
    });
    if(isOnStatusPage())
    {
        LogMessage("on status page");
        awaitElem(main, tweetQuery, argsChildAndSub).then((tweet) => { listenForMediaType(tweet.parentElement); });
    }
}

//<--> RIGHT SIDEBAR CONTENT <-->//

let nsfwBlur = true;
var nsfwToggle = null;
var nsfwToggleChanged = new EventTarget();

async function setupNSFWToggle(sidePanel)
{
    nsfwBlur = await getUserPref(usePref_blurNSFW, false);
    nsfwToggle = sidePanel.querySelector('#thd_nsfwToggle');

    if(nsfwToggle == null)
    {

        nsfwToggle = createToggleButton(nsfwBlur ? "NSFW Blur ON" : "NSFW Blur OFF", "thd_nsfwToggle");
        nsfwToggle.marginBottom = "10px";
        nsfwToggle.addEventListener('click', (e) => {
            nsfwBlur = nsfwBlur ? false : true;
            setUserPref(usePref_blurNSFW, nsfwBlur);
            nsfwToggleChanged.dispatchEvent(new Event('nsfwToggleChanged'));
            nsfwToggle.innerHTML = nsfwBlur ? "NSFW Blur ON" : "NSFW Blur OFF";
        });

        const footer = sidePanel.querySelector('nav').parentElement.appendChild(nsfwToggle);
    }
}

async function processBlurButton(tweet)
{
    const blurBtn = tweet.querySelector('div[role="button"][style^="backdrop-filter: blur"]');

    if(blurBtn != null)
    {
        if(!nsfwBlur)
        {
            blurBtn.click();
        }

        blurBtn.style.display = nsfwBlur ? "block" : "none";

        watchForChange(tweet, {attributes: false, childList: true, subtree: true}, (blurParent, mutes) => {
            const curBlur = blurParent.querySelector('div[role="button"][style^="backdrop-filter: blur"]');
            if(curBlur == null) { return; }
            if(addHasAttribute(curBlur, modifiedAttr)) { return; }
            curBlur.style.display = nsfwBlur ? "block" : "none";
            nsfwToggleChanged.addEventListener("nsfwToggleChanged", function() {
                curBlur?.click();
                curBlur.style.display = nsfwBlur ? "block" : "none";
            });
        });
    }
}

async function setupTrendingControls(trendingBox)
{
    const showStr = "Show";
    const hideStr = "Hide";

    const setTrendingVisible = function(container, button, hidden)
    {
        container.style.maxHeight = hidden ? "44px" : "none";
        button.innerText = hidden ? showStr : hideStr;
        setUserPref(usePref_hideTrendingKey, hidden);
    };

    let trendingTitle = await awaitElem(trendingBox, 'h2', argsChildAndSub);

    if(!addHasAttribute(trendingTitle, modifiedAttr))
    {
        let toggle = trendingTitle.querySelector('#thd_toggleTrending');

        if(toggle == null)
        {
            toggle = createToggleButton(hideStr, "thd_toggleTrending");
            toggle.addEventListener('click', (e) => {
                var isHidden = toggle.innerText == hideStr;
                setTrendingVisible(trendingBox, toggle, isHidden);
            });
            trendingTitle.appendChild(toggle);
        }
        getUserPref(usePref_hideTrendingKey, true).then((visible) => {
            setTrendingVisible(trendingBox, toggle, visible);
            watchForChange(trendingBox, argsChildAndSub, setupTrendingControls);
        });

    }
}

function createToggleButton(text, id)
{
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.id = id;
    btn.style.borderRadius = "9999px";
    btn.style.borderStyle = "solid";
    btn.style.borderWidth = "1px";
    btn.style.borderColor = "#00000000";
    btn.style.backgroundColor = "#292828";
    btn.style.color = "#cdccc8";
    return btn;
}

//<--> FULL-SCREEN IMAGE VIEW RELATED <-->//

async function onLayersChange(layers, mutation)
{
    if(mutation.addedNodes != null && mutation.addedNodes.length > 0)
    {
        const contentContainer = Array.from(mutation.addedNodes)[0];
        const dialog = await awaitElem(contentContainer, 'div[role="dialog"]', argsChildAndSub);
        const img = await awaitElem(dialog, 'img[alt="Image"]', argsChildAndSub);
        const list = dialog.querySelector('ul[role="list"]');
        let tweetInfo = getTweetInfo(img);

        if(list != null/* && !addHasAttribute(list, 'thd_modified')*/)
        {
            const listItems = list.querySelectorAll('li');
            const itemCnt = listItems.length;

            for(let i = 0; i < itemCnt; i++)
            {
                let listItem = await awaitElem(listItems[i], 'img[alt="Image"]', argsChildAndSub);
                tweetInfo = { ...tweetInfo };
                tweetInfo.elemIndex = i + 1;
                updateFullViewImage(listItem, tweetInfo);
            }
        }
        else
        {
            tweetInfo.elemIndex = -1;
            updateFullViewImage(img, tweetInfo);
        }
    }
}

async function updateFullViewImage(img, tweetInfo)
{
    if(addHasAttribute(img, "thd_modified")) { return; }
    let bg = img.parentElement.querySelector('div');
    let hqSrc = getHighQualityImage(img.src);
    addCustomCtxMenu(img, hqSrc, tweetInfo, img);
    updateImgSrc(img, bg, hqSrc);
    doOnAttributeChange(img, (imgElem) => {updateImgSrc(imgElem, bg, hqSrc);}, false);
}

//<--> RIGHT-CLICK CONTEXT MENU STUFF START <-->//

const ctxMenu = document.createElement('div');
ctxMenu.id = "contextMenu";
ctxMenu.className = "context-menu";
setContextMenuVisible(false);

const ctxMenuList = document.createElement('ul');
ctxMenu.appendChild(ctxMenuList);

const ctxMenuOpenInNewTab = createCtxMenuItem(ctxMenuList, "Open Image in New Tab");
const ctxMenuSaveAs = createCtxMenuItem(ctxMenuList, "Save Image As");
const ctxMenuCopyImg = createCtxMenuItem(ctxMenuList, "Copy Image");
const ctxMenuCopyAddress = createCtxMenuItem(ctxMenuList, "Copy Image Address");
const ctxMenuGRIS = createCtxMenuItem(ctxMenuList, "Search Google for Image");
const ctxMenuShowDefault = createCtxMenuItem(ctxMenuList, "Show Default Context Menu");

document.body.appendChild(ctxMenu);
document.body.addEventListener('click', function(e) { setContextMenuVisible(false); });

function createCtxMenuItem(menuList, text)
{
    let menuItem = document.createElement('LI');
    menuItem.innerText = text;
    menuList.appendChild(menuItem);
    return menuItem;
}

function mouseX(evt) {
  if (evt.pageX) {
    return evt.pageX;
  } else if (evt.clientX) {
    return evt.clientX + (document.documentElement.scrollLeft ?
      document.documentElement.scrollLeft :
      document.body.scrollLeft);
  } else {
    return null;
  }
}
function mouseY(evt) {
  if (evt.pageY) {
    return evt.pageY;
  } else if (evt.clientY) {
    return evt.clientY + (document.documentElement.scrollTop ?
      document.documentElement.scrollTop :
      document.body.scrollTop);
  } else {
    return null;
  }
}

function setContextMenuVisible(visible)
{
    ctxMenu.style.display = visible ? "block" : "none";
}

var selectedShowDefaultContext = false;
//To avoid the value being captured when setting up the event listeners.
function wasShowDefaultContextClicked()
{
    return selectedShowDefaultContext;
}

function updateContextMenuLink(dlURL, tweetInfo, img)
{
    img.crossOrigin = 'Anonymous'; //Needed to avoid browser preventing the Canvas from being copied when doing "Copy Image"
    ctxMenuSaveAs.onclick = () => { setContextMenuVisible(false); download(dlURL, filenameFromTweetInfo(tweetInfo)) };
    ctxMenuOpenInNewTab.onclick = () => {
        setContextMenuVisible(false);
        if(GM_OpenInTabMissing)
        {
            var lastWin = window;
            window.open(dlURL, '_blank');
            lastWin.focus();
        } else { GM_openInTab(dlURL, {active: false, insert: true, setParent: true, incognito: false}); }
    };
    ctxMenuCopyImg.onclick = () =>
    {
        setContextMenuVisible(false);
        try
        {
            let c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
            c.toBlob((png) =>
                     {
                navigator.clipboard.write([ new ClipboardItem({ [png.type]: png }) ]);
            }, "image/png", 1);
        } catch (err){ console.log(err); };
    };
    ctxMenuCopyAddress.onclick = () => { setContextMenuVisible(false); navigator.clipboard.writeText(dlURL); };
    ctxMenuGRIS.onclick = () => { setContextMenuVisible(false); window.open("https://images.google.com/searchbyimage?image_url=" + dlURL); };
    ctxMenuShowDefault.onclick = () => { selectedShowDefaultContext = true; setContextMenuVisible(false); };
}

function addCustomCtxMenu(elem, dlLink, tweetInfo, img)
{
    if(addHasAttribute(elem, "thd_customctx")) { return; }
    elem.addEventListener('contextmenu', function(e)
    {
        if(wasShowDefaultContextClicked()) { selectedShowDefaultContext = false; } //Skip everything here and show default context menu
        else if(ctxMenu.style.display == "block") { e.preventDefault(); setContextMenuVisible(false); }
        else
        {
            updateContextMenuLink(dlLink, tweetInfo, img);
            setContextMenuVisible(true);
            ctxMenu.style.left = mouseX(e) + "px";
            ctxMenu.style.top = mouseY(e) + "px";
            e.preventDefault();
        }
    }, false);
}

//<--> TWITTER UTILITY FUNCTIONS <-->//

//Because Firefox doesn't assume the format unlike Chrome...
function getMediaFormat(url)
{
    let end = url.split('/').pop();
    let periodSplit = end.split('.');
    if(periodSplit.length > 1)
    {
        return '.' + periodSplit.pop().split('?')[0];
    }
    if(url.includes('format='))
    {
        let params = url.split('?').pop().split('&');
        for(let p = 0; p < params.length; p++)
        {
            if(params[p].includes('format'))
            {
                return '.' + params[p].split('=').pop().split('?')[0];
            }
        }
    }

    return '';
}

function isDirectImagePage(url) //Checks if webpage we're on is a direct image view
{
    if(url.includes('/media/') && url.includes('format=') && url.includes('name='))
    {
        if(!url.includes('name=orig'))
        {
            const hqUrl = getHighQualityImage(url);
            window.location.href = getHighQualityImage(url);
        }
        return true;
    }
    return false;
}

function isOnStatusPage() { return document.location.href.includes('/status/'); }

function download(url, filename)
{
    GM_download({
        name: filename + getMediaFormat(url),
        url: url,
        onload: function() { /*LogMessage(`Downloaded ${url}!`);*/}
    });
}

function getUrlFromTweet(tweet)
{
    let curUrl = window.location.href;
    if(curUrl.includes('/photo/')) { return curUrl; } //Probably viewing full-screen image

    let article = tweet.tagName.toUpperCase() == 'ARTICLE' ? tweet : tweet.closest('article');

    if(article == null) { return null; }

    let postLink = article.querySelector('a:not([href*="/retweets"],[href$="/likes"])[href*="/status/"][role="link"][dir="auto"]');
    let imgLink = article.querySelector('a:not([href*="/retweets"],[href$="/likes"],[dir="auto"])[href*="/status/"][role="link"]');

    if(imgLink)
    {
        let statusLink = imgLink.href.split('/photo/')[0];
        let imgUser = statusLink.split('/status/')[0];
        if(postLink == null || !postLink.href.includes(imgUser)) { return statusLink; }
    }

    if(postLink) { return postLink.href; }

    if(curUrl.includes('/status/')) { return curUrl; } //Last resort, not guranteed to actually be for the element in the timeline we are processing
    return null;
}

function getTweetInfo(tweet)
{
    let link = getUrlFromTweet(tweet);
    if(link == null) { return null; }
    //LogMessage(link);

    let url = link.split('?')[0];
    let photoUrl = url.split('/photo/');
    url = photoUrl[0];
    const urlSplit = url.split('/status/');
    const id = urlSplit[1].split('/')[0];

    let username = urlSplit[0].split('/').pop();
    let attributeTo = tweet.querySelector('div[aria-label]');
    let elementIndex = -1;
    if(photoUrl.length > 1) { elementIndex = parseInt(photoUrl[1]); LogMessage(url + " : " + photoUrl[1]); }

    return { id: id, url: url, username: username, elemIndex: elementIndex }
}

function filenameFromTweetInfo(tweetInfo)
{
    let filename = tweetInfo.username + ' - ' + tweetInfo.id;
    if(tweetInfo.elemIndex >= 0) { filename += '_' + tweetInfo.elemIndex.toString();}
    return filename;
}

function getHighQualityImage(url)
{
    return url.replace(/(?<=[\&\?]name=)([A-Za-z0-9])+(?=\&)?/, 'orig');
}

function getVidURL(id)
{
    return new Promise((resolve, reject) =>
    {
        var init =
        {
            origin: 'https://mobile.twitter.com',
            headers: {
                "Accept": '*/*',
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0",
                "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
                "x-csrf-token": cooky,
            },
            credentials: 'include',
            referrer: 'https://mobile.twitter.com'
        };
        const fetchURL = "https://api.twitter.com/1.1/statuses/show.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&trim_user=false&include_ext_media_color=true&id=";
        try
        {
            fetch(fetchURL + id, init).then(function(response)
            {
                if (response.status == 200)
                {
                    response.json().then(function(json)
                    {
                        let entities = json.extended_entities;
                        if(entities == undefined || entities == null) { resolve(null); }
                        let mp4Variants = entities.media[0].video_info.variants.filter(variant => variant.content_type === 'video/mp4');
                        mp4Variants = mp4Variants.sort((a, b) => (b.bitrate - a.bitrate));
                        resolve((mp4Variants.length) ? mp4Variants[0].url : null);
                        return;
                    });
                }
                else { resolve(null); }
            }).catch((err) => { reject({ error: err }); resolve(null); });
        } catch (err) {resolve(null);}
    });
}

//<--> GENERIC UTILITY FUNCTIONS <-->//
async function watchForChange(root, obsArguments, onChange)
{
    const rootObserver = new MutationObserver(function(mutations) {
        mutations.forEach((mutation) => onChange(root, mutation));
    });
    rootObserver.observe(root, obsArguments);
}

async function watchForAddedNodes(root, stopAfterFirstMutation, obsArguments, executeAfter)
{
    const rootObserver = new MutationObserver(
        function(mutations)
        {
          //  LogMessage("timeline mutated");
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
         const rootObserver = new MutationObserver((mutes, obs) => { findElem(root, query, obs, resolve); } );
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

function addHasAttribute(elem, attr)
{
    if(elem.hasAttribute(attr)) { return true; }
    elem.setAttribute(attr, "");
    return false;
}

function getCookie(name)
{
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if(match) { return match[2].toString(); }
    return null;
}

function getCSSRuleContainingStyle(styleName, selectors, styleCnt = 0, matchingValue = "")
{
    var sheets = document.styleSheets;
    for (var i = 0, l = sheets.length; i < l; i++)
    {
        var curSheet = sheets[i];

        if( !curSheet.cssRules ) { continue; }

        for (var j = 0, k = curSheet.cssRules.length; j < k; j++)
        {
            var rule = curSheet.cssRules[j];
            if(styleCnt != 0 && styleCnt != rule.style.length) { return null; }
            if (rule.selectorText && rule.style.length > 0/* && rule.selectorText.split(',').indexOf(selector) !== -1*/)
            {
                for(var s = 0; s < selectors.length; s++)
                {
                    if(rule.selectorText.includes(selectors[s]) && rule.style[0] == styleName)
                    {
                        if(matchingValue === "" || matchingValue == rule.style[styleName])
                        {
                            return rule;
                        }
                    }
                }
            }
        }
    }
    return null;
}

async function getUserPref(key, defaultVal)
{
  if(isGM) { return await GM.getValue(key, defaultVal); }
  return await GM_getValue(key, defaultVal);
}
async function setUserPref(key, value)
{
  if(isGM) { return await GM.setValue(key, value); }
	return await GM_setValue(key, value);
}

function LogMessage(text) { /*console.log(text);*/ }

function addGlobalStyle(css) {
    let head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
    return style;
}

//<--> BEGIN PROCESSING <-->//

async function LoadPrefs()
{
    getUserPref(usePref_blurNSFW, false).then((res) => {nsfwBlur = res;});
}

(async function() {
    'use strict';
    if(isDirectImagePage(window.location.href)) { return; }

    NodeList.prototype.forEach = Array.prototype.forEach;
	LoadPrefs();
	await awaitElem(document, 'BODY', argsChildAndSub);
    let isIframe = document.body.querySelector('div#app');

    if(isIframe != null)
    {
        awaitElem(isIframe, 'article[role="article"]', argsChildAndSub).then(listenForMediaType);
        return;
    }
    const reactRoot = await awaitElem(document.body, 'div#react-root', argsChildAndSub);
    const main = await awaitElem(reactRoot, 'main[role="main"] div', argsChildAndSub);

    let layers = reactRoot.querySelector('div#layers');

    awaitElem(reactRoot, 'div#layers', argsChildAndSub).then((layers) => {
        if(!addHasAttribute(layers, "watchingLayers")) { watchForChange(layers, {childList: true, subtree: true}, onLayersChange); }
    });

    addHasAttribute(main, modifiedAttr);
    onMainChange(main);
    watchForChange(main, argsChildOnly, onMainChange);

})();
