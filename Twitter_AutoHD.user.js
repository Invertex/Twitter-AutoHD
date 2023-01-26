// ==UserScript==
// @name         Twitter AutoHD
// @namespace    Invertex
// @version      1.78
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
const argsChildAndSub = { attributes: false, childList: true, subtree: true };
const argsChildOnly = { attributes: false, childList: true, subtree: false };
const argsChildAndAttr = { attributes: true, childList: true, subtree: false };

const dlSVG = '<g><path d="M 8 51 C 5 54 5 48 5 42 L 5 -40 C 5 -45 -5 -45 -5 -40 V 42 C -5 48 -5 54 -8 51 L -48 15 C -51 12 -61 17 -56 22 L -12 61 C 0 71 0 71 12 61 L 56 22 C 61 17 52 11 48 15 Z"></path>' +
    '<path d="M 56 -58 C 62 -58 62 -68 56 -68 H -56 C -62 -68 -62 -58 -56 -58 Z"></path></g>';

const bookmarkSVG = '<g><path d="M17 3V0h2v3h3v2h-3v3h-2V5h-3V3h3zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V11h2v11.94l-8-5.71-8 5.71V4.5C4 3.12 5.119 2 6.5 2h4.502v2H6.5z"></path></g>';
const unbookmarkSVG = '<g><path d="M16.586 4l-2.043-2.04L15.957.54 18 2.59 20.043.54l1.414 1.42L19.414 4l2.043 2.04-1.414 1.42L18 5.41l-2.043 2.05-1.414-1.42L16.586 4zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V11h2v11.94l-8-5.71-8 5.71V4.5C4 3.12 5.119 2 6.5 2h4.502v2H6.5z"></path></g>';

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

const usePref_toggleLiked = "thd_toggleLiked";
const usePref_toggleRetweet = "thd_toggleRetweet";
const usePref_toggleFollowed = "thd_toggleFollowed";
const usePref_toggleTopics = "thd_toggleTopics";
const usePref_toggleClearTopics = "thd_toggleClearTopics";
const usePref_lastTopicsClearTime = "thd_lastTopicsClearTime";
const usePref_toggleTimelineScaling = "thd_toggleTimelineScaling";
const usePref_toggleAnalyticsDisplay = "thd_toggleAnalyticsDisplay";

//Greasemonkey does not have this functionality, so helpful way to check which function to use
const isGM = (typeof GM_addValueChangeListener === 'undefined');


//<--> TWEET PROCESSING <-->//
function StringBuilder(value)
{
    this.strings = new Array();
    this.append(value);
}
StringBuilder.prototype.append = function (value)
{
    if (value)
    {
        this.strings.push(value);
    }
}
StringBuilder.prototype.clear = function ()
{
    this.strings.length = 0;
}
StringBuilder.prototype.toString = function ()
{
    return this.strings.join("");
}

const sb = new StringBuilder("");

const BuildM3U = function (lines)
{
    const regex = /,BANDWIDTH=(.*),RESOLUTION/gm;

    let bestLine = 0;
    let bestBandwidth = 0;
    sb.append(lines[0]);

    for (let i = 1; i < lines.length; i++)
    {
        if (!lines[i].includes('STREAM-INF:')) { sb.append('#' + lines[i]); }
        else
        {
            let bandwidth = parseInt(regex.exec(lines[i]));
            if (bandwidth > bestBandwidth)
            {
                bestBandwidth = bandwidth;
                bestLine = i;
            }
            else if (bestLine === 0) { bestLine = i; } //failsafe in case something breaks with parsing down the line
        }
    }

    sb.append('#' + lines[bestLine]);
    let m3u = sb.toString();
    sb.clear();

    return m3u;
};

//Intercept m3u8 playlist requests and modify the contents to only include the highest quality
(function (open)
{
    XMLHttpRequest.prototype.open = function (method, url)
    {
        if (url.includes('video.twimg.com') && url.includes('.m3u8?'))
        {
            this.addEventListener('readystatechange', function (e)
            {

                if (this.readyState === 4)
                {

                    const lines = e.target.responseText.split('#');
                    const m3u = BuildM3U(lines);

                    Object.defineProperty(this, 'response', { writable: true });
                    Object.defineProperty(this, 'responseText', { writable: true });
                    this.response = this.responseText = m3u;
                }
            });
        }
        else if(url.includes('show.json?'))
        {
            this.addEventListener('readystatechange', function (e)
            {
                if (this.readyState === 4)
                {
                    let json = JSON.parse(e.target.response);

                    let vidInfo = json.extended_entities?.media?.video_info ?? null;

                    if(vidInfo != null && vidInfo.variants != null && vidInfo.variants.length > 1)
                    {
                        let variants = vidInfo.variants;

                        let lastGoodBitrate = 0;
                        let baseVariant = variants[0];

                        for(let i = variants.length - 1; i <= 0; i--)
                        {
                            let variant = variants[i];

                            if(variant.bitrate != null && (baseVariant.bitrate == null || variant.bitrate > baseVariant.bitrate))
                            {
                                baseVariant = variant;
                                variants[0] = variant;
                                variants.splice(i, 1);
                            }

                        }

                        Object.defineProperty(this, 'responseText', { writable: true });
                        this.responseText = JSON.stringify(json);
                    }
                }
            })
        }
        else if(url.includes('/HomeTimeline'))
        {
         //   url = url.replace('includePromotedContent%22%3Atrue%2C%22','');
         //   url = url.replace('Community%22%3Atrue%2C%22withSuperFollowsUserFields%22%3Atrue', 'Community%22%3Afalse%2C%22withSuperFollowsUserFields%22%3Afalse');
        //    url = url.replace('withSuperFollowsTweetFields%22%3Atrue', 'withSuperFollowsTweetFields%22%3Afalse');
         //   url = url.replace('latestControlAvailable%22%3Atrue', 'latestControlAvailable%22%3Afalse');
         //   url = url.replace('vibe_api_enabled%22%3Atrue', 'vibe_api_enabled%22%3Afalse');
        //    url = url.replace('withDownvotePerspective%22%3Afalse', 'withDownvotePerspective%22%3Atrue');

           url = url.replace('count%22%3A20', 'count%22%3A50');

            this.addEventListener('readystatechange', function (e)
            {
                if (this.readyState === 4)
                {

                    let json = JSON.parse(e.target.response);

                    if(json.data && json.data.home)
                    {
                        json.data.home.home_timeline_urt.instructions[0].entries = processTweetsQuery(json.data.home.home_timeline_urt.instructions[0].entries);

                        Object.defineProperty(this, 'responseText', { writable: true });

                        this.responseText = JSON.stringify(json);
                    }
                }
            })
        }

        open.apply(this, arguments);
    };
})(XMLHttpRequest.prototype.open);

var firstRun = true;

function processTweetsQuery(entries)
{
    for(let i = entries.length - 1; i >= 0; i--)
    {

        let entry = entries[i];

        if(entry.content == null || entry.content.itemContent == null || entry.content.itemContent.tweet_results == null) { continue; }
        if(firstRun && entries.length <= 4) //Avoid the timeline freezing from not enough initial entries
        {
            continue;
        }

        if(entry.content.itemContent && entry.content.itemContent.promotedMetadata && entry.content.itemContent.promotedMetadata.advertiser_results)
        {
            entries.splice(i, 1);
        }
        else if(entries[i].content.itemContent && entries[i].content.itemContent.socialContext)
        {

            let contextType = entry.content.itemContent.socialContext.contextType;

            if((!toggleLiked.enabled && contextType == "Like") || (!toggleFollowed.enabled && contextType == "Follow") || (!toggleTopics.enabled && entry.content.itemContent.socialContext.type == "TimelineTopicContext"))
            {
                entries.splice(i, 1);
            }

        }
        else if(!toggleRetweet.enabled
                && entry.content.itemContent.tweet_results.result.legacy != null
                && entry.content.itemContent.tweet_results.result.legacy.retweeted_status_result != null
               && entry.content.itemContent.tweet_results.result.legacy.retweeted_status_result.result.core.user_results.result.legacy.following == false) //Only hide the Retweet if it's not the user's own tweet
        {

             entries.splice(i, 1);
        }
    }

    firstRun = false;
    return entries;
}


function getPostButtonCopy(tweet, name, svg, svgViewBox, color, bgColor)
{
        //console.log("add dl button");
    let getButtonToDupe = function (btnGrp) { return btnGrp.lastChild.cloneNode(true); };
    let isIframe = false;
    let id = "thd_button_" + name;

    let buttonGrp = tweet.closest('article[role="article"]')?.querySelector('div[role="group"][id^="id__"]');
    if (buttonGrp == null) //Try iframe version
    {
        buttonGrp = tweet.querySelector('div a[href*="like?"]')?.parentElement;
        if (buttonGrp != null)
        {
            isIframe = true;
            getButtonToDupe = function (btnGrp)
            {
                return btnGrp.querySelector('a:nth-child(2)').cloneNode(true);
            };
        }
    }
    if (buttonGrp == null || buttonGrp.querySelector("div#" + id) != null) { return null; } //Button group doesn't exist or we already processed this element and added a DL button

    buttonGrp.style.maxWidth = "100%";

    if(!toggleAnalyticsDisplay.enabled)
    {
        let analBtn = buttonGrp.querySelector('a[href$="/analytics"]');
        if(analBtn) { analBtn.parentElement.remove(); }
    }

    let btn = getButtonToDupe(buttonGrp);

    if(btn != null)
    {
        buttonGrp.appendChild(btn);
        btn.id = id;
        btn.style.marginRight = "8px";
        btn.style.marginLeft = "8px";
        $(btn.parentNode).addClass(btn.className);
        btn.setAttribute('aria-label', name);
        btn.title = name;
        const iconDiv = isIframe ? btn.querySelector('div[dir="auto"]') : btn.querySelector('div[dir="ltr"]');
        const svgElem = btn.querySelector('svg');
        const bg = isIframe ? svgElem.parentElement : iconDiv.firstElementChild.firstElementChild;

        svgElem.innerHTML = svg;

        svgElem.setAttribute('viewBox', svgViewBox);

        const oldBGColor = $(bg).css("background-color");
        const oldIconColor = $(iconDiv).css("color");
        //Emulate Twitter hover color change
        $(btn).hover(function ()
                       {
            $(bg).css("background-color", bgColor);
            $(bg).css("border-radius", "20px");
            $(svgElem).css("color", color);
        }, function ()
                       {
            $(bg).css("background-color", oldBGColor);
            $(svgElem).css("color", oldIconColor);
        });
    }

    return {btn: btn, inIframe: isIframe};
}


async function addBookmarkButton(tweet)
{
    const btnCopy = getPostButtonCopy(tweet, "Bookmark", bookmarkSVG, "0 0 24 24", "#B000B5FF", "#f3d60720");
    if(btnCopy == null) { return; }

    let btn = btnCopy.btn;
    if(btn != null)
    {
        let id = "";

        let link = tweet.querySelector('div > a[href*="/status/"] > time');
        if(link)
        {
            link = link.parentElement;
            id = getIDFromURL(link.href);
        }
        else
        {
            id = getIDFromTweet(tweet);
        }

        $(btn).click(function (e)
       {
                e.preventDefault();
                e.stopPropagation();
            bookmarkPost(id);
            console.log("bookmarked");
            });

      //  btn.addEventListener(new MouseEvent('click'), ()=> { });
    }
}

async function addDownloadButton(tweet, vidUrl, tweetInfo)
{

    const btnCopy = getPostButtonCopy(tweet, "Download", dlSVG, "-80 -80 160 160", "#f3d607FF", "#f3d60720");
      if(btnCopy == null) { return; }
    const dlBtn = btnCopy.btn;

    if(dlBtn == null || btnCopy == null) { return; }

    let isIframe = btnCopy.inIframe;
    const filename = filenameFromTweetInfo(tweetInfo);

    dlBtn.href = vidUrl;

    const linkElem = isIframe ? dlBtn : $(dlBtn).wrapAll(`<a href="${vidUrl}" download="${filename}" style=""></a>`)[0].parentElement;

    if (isIframe)
    {
        linkElem.setAttribute('download', filename);
        dlBtn.querySelector('div[dir="auto"] > span').innerText = "Download";
    }
    else
    {
        dlBtn.style.marginLeft = "";
        linkElem.style.cssText = dlBtn.style.cssText;
        dlBtn.style.marginRight = "";
    }


    $(linkElem).click(function (e) { e.preventDefault();
        e.stopPropagation();
        download(vidUrl, filename); });
}


async function updateEmbedMedia(tweet, embed)
{
    let vid = await awaitElem(embed, 'video', argsChildAndSub);
    let tweetInfo = await getTweetInfo(tweet);

    let poster = vid.getAttribute('poster');

    if(poster != null)
    { //Most likely a blob video so we'll need the poster attribute ID to query the source video
        poster = getIDFromPoster(poster);
    }

    getVidURL(tweetInfo.id, vid, poster).then((src) => {
        addCustomCtxMenu(embed, src, tweetInfo, vid);
     });
}

function waitForImgLoad(img)
{
    return new Promise((resolve, reject) =>
    {
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

function updateImgSrc(imgElem, bgElem, src)
{
    if (imgElem.src != src)
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

    if (!img.complete || img.naturalHeight == 0) { await waitForImgLoad(img); }
    naturalHeight = img.naturalHeight;
    naturalWidth = img.naturalWidth;
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
    const updatePadding = function (panelCnt, background, imgContainerElem)
    {
        if (panelCnt != 3)
        {
            background.style.backgroundSize = "cover";
            //imgContainerElem.style.marginBottom = "0%";
        }
        if (panelCnt < 2)
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
    doOnAttributeChange(imgContainer, (container) => updatePadding(imgCnt, bg, container), true);

    const flexDir = $(imgLink.parentElement).css('flex-direction');
    return { imgElem: img, bgElem: bg, layoutContainer: imgLink.parentElement, width: img.naturalWidth, height: img.naturalHeight, flex: flexDir, hqSrc: hqSrc };
}


async function updateImageElements(tweet, imgLinks)
{
    if (tweet != null && imgLinks != null)
    {
        let imgCnt = imgLinks.length;
        if (imgCnt == 0) { return; }

        if (addHasAttribute(imgLinks[0], modifiedAttr)) { return; }

        let tweetInfo = await getTweetInfo(tweet);

        processBlurButton(tweet);

        const images = [];

        for (let link = 0; link < imgCnt; link++)
        {
            if (imgCnt > 1)
            {
                tweetInfo = { ...tweetInfo }; //Shallow copy to avoid changing the data for another image
                tweetInfo.elemIndex = link + 1; //Set our element index so we can add it to our filename later to differentiate the multi-images of a post ID
            }

            let imgData = await updateImageElement(tweetInfo, imgLinks[link], imgCnt);
            images.push(imgData);
        }

        imgCnt = images.length;
        let ratio = 100;

        if (imgCnt > 0)
        {
            ratio = (images[0].height / images[0].width) * 100;
        }
        if (imgCnt == 2)
        {
            let img1 = images[0];
            let img2 = images[1];
            let img1Ratio = img1.height / img1.width;
            let img2Ratio = img2.height / img2.width;
            var imgToRatio = img1Ratio > img2Ratio ? img1 : img2;
            ratio = (imgToRatio.height / imgToRatio.width);

            img1.bgElem.style.backgroundSize = "cover";
            img2.bgElem.style.backgroundSize = "cover";
            img1.layoutContainer.removeAttribute("style");
            img2.layoutContainer.removeAttribute("style");

            if (img1.flex == "row")
            {
                if (imgToRatio.height > imgToRatio.width)
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
        else if (imgCnt == 3 && images[0].flex == "row")
        {
            let img1 = images[0];
            let img1Ratio = img1.height / img1.width;
            if (img1Ratio < 1.10 && img1Ratio > 0.9) { img1.bgElem.style.backgroundSize = "contain"; }
        }
        else if (imgCnt == 4)
        {
            if (images[0].width > images[0].height &&
                images[1].width > images[1].height &&
                images[2].width > images[2].height &&
                images[3].width > images[3].height)
            {} //All-wide 4-panel already has an optimal layout by default.
            else if (images[0].width > images[0].height)
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

        const padder = tweet.querySelector('div[id^="id_"] div[style^="padding-bottom"]');
		if(padder != null)
		{
			const flexer = padder.closest('div[id^="id_"] > div');
			const bg = flexer.querySelector('div[style^="background"] > div');

			padder.parentElement.style = "";
			padder.style = `padding-bottom: ${ratio}%;`;
			const modPaddingAttr = "modifiedPadding";
			padder.setAttribute(modPaddingAttr, "");
			padder.parentElement.setAttribute(modPaddingAttr, "");
			flexer.style = "align-self:normal; !important"; //Counteract Twitter's new variable width display of content that is rather wasteful of screenspace
            if(bg) { bg.style.width = "100%"; }
		}

        for (let i = 0; i < imgCnt; i++)
        {
            let curImg = images[i];
            updateImgSrc(curImg, curImg.bgElem, curImg.hqSrc);
            doOnAttributeChange(curImg.layoutContainer, () => { updateImgSrc(curImg, curImg.bgElem, curImg.hqSrc) });
        }

        //Annoying Edge....edge-case. Have to find this random class name generated element and remove its align so that elements will expand fully into the feed column
        var edgeCase = getCSSRuleContainingStyle('align-self', ['.r-'], 0, 'flex-start');
        if (edgeCase != null)
        {
            edgeCase.style.setProperty('align-self', "inherit");
        }

        if(padder != null)
        {
            doOnAttributeChange(padder, (padderElem) => { if(padderElem.getAttribute("modifiedPadding") == null) { padderElem.style = "padding-bottom: " + (ratio) + "%;";} })
            doOnAttributeChange(padder.parentElement, (padderParentElem) => { if(padderParentElem.getAttribute("modifiedPadding") == null) { padderParentElem.style = "";} })
        }
    }
}

function onLoadVideo(xmlDoc, tweetElem, tweetInfo)
{
    const qualityEntry = xmlDoc.querySelector('table.table tbody tr'); //First quality entry will be highest
    if (qualityEntry == null) { return; } //Couldn't get a source URL. In future setup own dev account to handle this
    let vidUrl = qualityEntry.querySelector('td a').href;
    if (vidUrl.includes("#")) { vidUrl = xmlDoc.querySelector('video#video source').src; }
    vidUrl = vidUrl.split('?')[0];
    vids.set(tweetInfo.id, vidUrl);
    //    LogMessage("cache vid: " + tweetInfo.id + ":" + vidUrl);
    addDownloadButton(tweetElem, vidUrl, tweetInfo);
};

async function onPlayButtonChange(vid, playContainer)
{
    let tabIndex = playContainer.querySelector('div[tabindex="0"]');
    if (tabIndex)
    {
        let spanner = tabIndex.querySelector('div[dir="auto"] > span > span, div[dir="auto"] > span');
        if (spanner && spanner.innerText == "GIF")
        {
            tabIndex.remove();
            vid.onmouseover = function ()
            {
                vid.setAttribute('controls', "");
            };
            vid.onmouseleave = function ()
            {
                if (!vid.paused) { vid.removeAttribute('controls'); }
            };

        }
        else { /* console.log(" no spanner found");*/ }
    }
}

async function watchPlayButton(vidElem)
{
    let playContainer = vidElem.parentElement.parentElement.parentElement;
    let gifPlayBtn = playContainer.querySelector('div[tabindex="0"][role="button"]');

    if (gifPlayBtn)
    {
        watchForChange(playContainer, { attributes: true, childList: true, subtree: true }, (playBtn, mutes) => { onPlayButtonChange(vidElem, playContainer); });
    }
}

function getLocalVidID(url)
{
    let split = url.split('/');
    let id = split[split.length - 1].split('.')[0];
    return id;
}

async function replaceVideoElement(tweet, vidElem)
{
    if (tweet == null) { return true; }
    const tweetInfo = await getTweetInfo(tweet);
    if (tweetInfo == null) { return true; }

    watchPlayButton(vidElem);

    if (vidElem.src.includes('/tweet_video/'))
    {
        //      LogMessage(`Is a GIF, used local src! : ${vidElem.src} id: ${tweetInfo.id} url: ${tweetInfo.url} username: ${tweetInfo.username}`);
        addDownloadButton(tweet, vidElem.src, tweetInfo);
        return true;
    }

    const cachedVidUrl = vids.get(tweetInfo.id);

    if (cachedVidUrl)
    {
        //    LogMessage(`used cached vid! : ${cachedVidUrl} id: ${tweetInfo.id} url: ${tweetInfo.url} username: ${tweetInfo.username}`);
        addDownloadButton(tweet, cachedVidUrl, tweetInfo);
        return true;
    }

    try
    {

        const vidUrl = await getVidURL(tweetInfo.id, vidElem, null);
        if (vidUrl != null) //Was able to grab URL using legacy Twitter API and user token
        {
            //    LogMessage(`found vid! : ${vidUrl} id: ${tweetInfo.id} url: ${tweetInfo.url} username: ${tweetInfo.username}`);
            addDownloadButton(tweet, vidUrl, tweetInfo);
             vids.set(tweetInfo.id, vidUrl);
            return true;
        }
    }
    catch (_) {}

    //Previous methods failed, use an external service for grabbing the video.
    GM_xmlhttpRequest(
    {
        method: "GET",
        url: requestUrl + tweetInfo.url,
        headers:
        {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html"
        },
        // overrideMimeType: "application/xml; charset=ISO-8859-1",
        // responseType: "document",
        onload: function (response) { onLoadVideo((new DOMParser()).parseFromString(response.response, "text/html"), tweet, tweetInfo); }
    });

  //  vids.set(tweetInfo.id, '');
    return true;
}

async function processTweet(tweet, tweetObserver)
{

    if (tweet == null /*|| (!isOStatusPage() && tweet.querySelector('div[data-testid="placementTracking"]') == null)*/ ) { return false; } //If video, should have placementTracking after first mutation
    if (tweet.getAttribute(modifiedAttr) != null || tweet.querySelector(`[${modifiedAttr}]`) ) { return true; }

    let foundContent = false;

     addBookmarkButton(tweet);

   // let waitForLoad = await awaitElem(tweet, 'div[data-testid="tweetPhoto"]', argsChildAndSub);
    const tweetPhotos = tweet.querySelectorAll('div[data-testid="tweetPhoto"]');
    const subElems = tweetPhotos.length;

    if(subElems == 0) { return; }

    let content = await awaitElem(tweetPhotos[0], 'div[aria-label="Image"] img[alt="Image"], video', argsChildAndSub);
  /*
*/


    const allLinks = Array.from(tweet.querySelectorAll('a'));

    const imgLinks = [];
    const quoteImgLinks = [];

    allLinks.forEach((imgLink) =>
    {
        let href = imgLink.href;
        if (href.includes('/photo/') || href.includes('/media/') /*&& imgLink.closest('div[tabindex][role="link"]') == null && imgLink.querySelector('div[data-testid="tweetPhoto"]') != null*/ )
        {
            if (imgLink.closest('div[tabindex][role="link"]') != null) { quoteImgLinks.push(imgLink); }
            else { imgLinks.push(imgLink); }
        }
        /*   else if(href.includes('t.co/')) //External website link
           {
               let img = imgLink.querySelector('img[src*="/card_img/"]');
               if(img) { quoteImgLinks.push(imgLink); LogMessage("Found card imag");}
           }*/
    });

    for(let embedIndex = 0; embedIndex < tweetPhotos.length; embedIndex++)
    {
        if(subElems == 1)
        {
            let vidContainer = tweetPhotos[0].querySelector('div[data-testid="videoPlayer"]');

            if(vidContainer != null)
            {

                let video = await awaitElem(vidContainer, 'VIDEO', argsChildAndSub);

                processBlurButton(tweet);

                if (replaceVideoElement(tweet, video))
                {
                    tweetObserver?.disconnect();
                    addHasAttribute(video, modifiedAttr);
                    foundContent = true;
                }

                return foundContent;
            }
        }
        else
        {

            foundContent = true;
            addHasAttribute(tweet, modifiedAttr);
            updateEmbedMedia(tweet, tweetPhotos[embedIndex]);
        }
    }
    if (imgLinks.length > 0)
    {
        //  tweetObserver.disconnect();
        updateImageElements(tweet, imgLinks);
        foundContent = true;
    }
    if (quoteImgLinks.length > 0)
    {
        //  tweetObserver.disconnect();
        updateImageElements(tweet, quoteImgLinks);
    }

    if (foundContent) {
        processBlurButton(tweet);
        addHasAttribute(tweet, modifiedAttr);
    }
}

const topicsFilter = 'a[href^="/i/topics/"]';
const likedFilter = 'a[href^="/i/user/"]';
const followsFilter = 'a[href="/i/timeline"]';

const setupToggle = function(elem, toggle)
{
    elem.style.display = toggle.enabled ? "block" : "none";
    toggle.listen((e)=>{
        elem.style.display = e.detail.toggle.enabled ? "block" : "none";
    });
}

/*
function setupFilters(tweet)
{
    return true;
    let socialCtx = tweet.querySelector('span[data-testid="socialContext"]');
    if(socialCtx != null)
    {
        let root = tweet.closest('[data-testid="cellInnerDiv"]');

        let topics = tweet.querySelector(topicsFilter);
        if(topics != null)
        {
            setupToggle(root, toggleTopics);
            if(!toggleTopics.enabled)
            {
                root.removeChild(root.firstElementChild);
            }
            return toggleTopics.enabled;
        }

        let followed = tweet.querySelector(followsFilter);
        if(followed != null)
        {
              if(!toggleFollowed.enabled)
            {
                  root.removeChild(root.firstElementChild);
            }
            setupToggle(root, toggleFollowed);
            return toggleFollowed.enabled;
        }

        let liked = tweet.querySelector(`likedFilter`);
        if(liked != null)
        {
            if(liked.href.includes('/user/') && root.firstElementChild.className.split(' ').length < 4)
            {
                //reply
                return true;
            }
            if(!toggleLiked.enabled)
            {
                 root.removeChild(root.firstElementChild);
            }
            setupToggle(root, toggleLiked);

            return toggleLiked.enabled;
        }
 Bugs to iron out
 //       let retweet = tweet.querySelector('a[href^="/"][dir="auto"][role="link"]');
 //       if(retweet != null)
 //       {
 //           setupToggle(root, toggleRetweet);
//        }


    }
       return true;
}
*/

async function listenForMediaType(tweet)
{
   // setupFilters(tweet)
    if (addHasAttribute(tweet, "thd_observing")) { return; }

  //  if(!setupFilters(tweet)) { return; }

    //  if(postRoot.querySelector('div[role="blockquote"]') != null) { LogMessage("bq"); return; } //Can't get the source post from the blockquote HTML, have to use Twitter API eventually
    const tweetObserver = new MutationObserver((muteList, observer) => { processTweet(tweet, observer); });
    processTweet(tweet, tweetObserver);
    tweetObserver.observe(tweet, { attributes: true, childList: true, subtree: true });
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
    if(mouseDown && mouseEvent.button != 0) { return; }
    let primaryRect = primaryColumn.getBoundingClientRect();
    let localPosX = mouseEvent.clientX - primaryRect.left;
    primaryColumnCursorDistToEdge = Math.abs(primaryRect.width - localPosX);

    if (mouseUp || primaryColumnCursorDistToEdge > 180)
    {
        primaryColumnResizing = false;
        if (mouseUp)
        {
            let primarySize = parseInt(maxWidthClass.style.getPropertyValue('max-width'));
            updateLayoutWidth(primarySize, true);
        }
    };
    if (primaryColumnCursorDistToEdge < 6 || primaryColumnResizing)
    {
        preCursor = document.body.style.cursor;
        document.body.style.cursor = "ew-resize";
        if (mouseDown)
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
    if (primaryColumnResizing)
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
    if(!toggleTimelineScaling.enabled) { return; }

    maxWidthClass.style.setProperty('max-width', width + "px");
    if (finalize)
    {
        headerColumn = document.body.querySelector('HEADER');
        headerColumn.style.flexGrow = 0.2;
        headerColumn.style.webkitBoxFlex = 0.2;
        setUserPref(usePref_MainWidthKey, width);
        return;
       /*
        let flexGrow = 600 / width;
        flexGrow *= flexGrow;
        let url = window.location.href;
        let mainTL = url.endsWith('/messages') || url.includes('/messages/') ? 0 : 1;
        let flex = (width >= 600) ? flexGrow : mainTL;
        headerColumn.style.flexGrow = flexGrow;
        headerColumn.style.webkitBoxFlex = flexGrow;
        setUserPref(usePref_MainWidthKey, width);*/
    }
}

function refreshLayoutWidth()
{
    let width = getUserPref(usePref_MainWidthKey, 600);
    updateLayoutWidth(width, true);
}

async function onTimelineContainerChange(container, mutations)
{
    LogMessage("on timeline container change");
    let tl = await awaitElem(container, 'DIV[style*="position:"]', { childList: true, subtree: true, attributes: true });
    observeTimeline(tl);
}

function onTimelineChange(addedNodes)
{
    //LogMessage("on timeline change");
    if (addedNodes.length == 0) { LogMessage("no added nodes"); return; }
    addedNodes.forEach((child) =>
    {
        //   if(addHasAttribute(child, modifiedAttr)) { return; }
        awaitElem(child, 'ARTICLE', argsChildAndSub).then(listenForMediaType);
        //  awaitElem(child, 'ARTICLE,ARTICLE '+ tweetQuery, argsChildAndSub).then(tweet => { listenForMediaType(tweet.parentElement); })
    });
}

function observeTimeline(tl)
{
    if (!addHasAttribute(tl, "thd_observing_timeline"))
    {
        LogMessage("starting timeline observation");
        const childNodes = Array.from(tl.childNodes);
        onTimelineChange(childNodes);

        watchForAddedNodes(tl, false, { attributes: false, childList: true, subtree: false }, onTimelineChange);
    }
}

async function watchForTimeline(primaryColumn, section)
{
    const checkTimeline = async function ()
    {
        let tl = await awaitElem(section, 'DIV[style*="position:"]', { childList: true, subtree: true, attributes: true });
        let progBar = tl.querySelector('[role="progressbar"]');
        if (progBar)
        {
            // Wait for an Article to show up before proceeding
         //   LogMessage("Has Prog Bar, Awaiting Article");
            let art = await awaitElem(section, "article", { childList: true, subtree: true, attributes: true });
          //  LogMessage("Found Article");
        }

        let tlContainer = tl.parentElement;
        if (!addHasAttribute(tlContainer, "thd_observing_timeline"))
        {
            observeTimeline(tl);
            watchForChange(tlContainer, { attributes: false, childList: true }, (tlc, mutes) => { onTimelineContainerChange(tlc, mutes); });
        }

    };

    checkTimeline();

    let progBarObserver = new MutationObserver((mutations) => { checkTimeline(); });
    progBarObserver.observe(section, { attributes: false, childList: true });
}

var pageWidthLayoutRule;

async function onMainChange(main, mutations)
{
    console.log("on main change");
    awaitElem(main, 'div[data-testid="primaryColumn"]', argsChildAndSub).then((primaryColumn) =>
    {
        if (addHasAttribute(primaryColumn, modifiedAttr)) { return; }

        //Watch to handle case where timelines are partially lost when clicking on the quoted post name.
        watchForChange(primaryColumn.firstElementChild, argsChildOnly, () => {
            awaitElem(primaryColumn, 'section[role="region"]', argsChildAndSub).then((section) => {
               watchForTimeline(primaryColumn, section);
            });
        });

        if(pageWidthLayoutRule == null) { pageWidthLayoutRule = getCSSRuleContainingStyle('width', (("." + main.className).replace(' ', ' .')).split(' ')); }

        if(toggleTimelineScaling.enabled)
        {
            pageWidthLayoutRule.style.setProperty('width', "100%");

            let primaryColumnGrp = primaryColumn.parentElement.parentElement;
            let columnClassNames = ("." + primaryColumn.className.replace(" ", " .")).split(' ');

            maxWidthClass = getCSSRuleContainingStyle("max-width", columnClassNames);
            getUserPref(usePref_MainWidthKey, 600).then((userWidth) => updateLayoutWidth(userWidth, true));

            primaryColumnGrp.addEventListener('mousemove', (e) => { primaryColumnResizer(primaryColumn, e, false, false) });
            primaryColumnGrp.addEventListener('mousedown', (e) => { primaryColumnResizer(primaryColumn, e, true, false) });
            window.addEventListener('mouseup', (e) => { primaryColumnResizer(primaryColumn, e, false, true) });
            document.addEventListener('mouseup', (e) => { primaryColumnResizer(primaryColumn, e, false, true) });
        }


        //  let section = awaitElem(primaryColumn, 'section[role="region"]', argsChildAndSub);
        awaitElem(primaryColumn, 'section[role="region"]', argsChildAndSub).then((section) => { LogMessage("region found");
            watchForTimeline(primaryColumn, section);
       });
    });
    awaitElem(main, 'div[data-testid="sidebarColumn"]', argsChildAndSub).then((sideBar) =>
    {
        awaitElem(sideBar, 'section[role="region"] > [role="heading"]', argsChildAndSub).then((sideBarTrending) =>
        {
            setupTrendingControls(sideBarTrending.parentElement);
            setupToggles(sideBar);
            clearTopicsAndInterests();
        });
    });
    if (isOnStatusPage())
    {
        LogMessage("on status page");
        awaitElem(main, tweetQuery, argsChildAndSub).then((tweet) => { listenForMediaType(tweet.parentElement); });
    }
}

//<--> RIGHT SIDEBAR CONTENT <-->//

var toggleNSFW;
var toggleLiked;
var toggleFollowed;
var toggleRetweet;
var toggleTopics;
var toggleClearTopics;
var toggleTimelineScaling;
var toggleAnalyticsDisplay;

await loadToggleValues();


async function getToggleObj(name)
{
    let isEnabled = await getUserPref(name, true);
    return {enabled: isEnabled, elem: null, name: name, onChanged: new EventTarget(), listen: function(func) { this.onChanged.addEventListener(this.name, func); }};
}

async function loadToggleValues()
{
    toggleNSFW = await getToggleObj(usePref_blurNSFW);
    toggleLiked = await getToggleObj(usePref_toggleLiked);
    toggleFollowed = await getToggleObj(usePref_toggleFollowed);
    toggleRetweet = await getToggleObj(usePref_toggleRetweet);
    toggleTopics = await getToggleObj(usePref_toggleTopics);
    toggleClearTopics = await getToggleObj(usePref_toggleClearTopics);
    toggleTimelineScaling = await getToggleObj(usePref_toggleTimelineScaling);
    toggleAnalyticsDisplay = await getToggleObj(usePref_toggleAnalyticsDisplay);

    if(!toggleAnalyticsDisplay.enabled)
    {
        addGlobalStyle('div[role="group"] > div > a[href$="/analytics"] { display: none !important; }');
    }
}


async function setupToggles(sidePanel)
{
    createToggleOption(sidePanel, toggleNSFW, false, "NSFW Blur ", "ON", "OFF");
    createToggleOption(sidePanel, toggleLiked, true, "Liked Tweets ", "ON", "OFF");
    createToggleOption(sidePanel, toggleFollowed, false, "Followed By Tweets ", "ON", "OFF");
    createToggleOption(sidePanel, toggleRetweet, true, "Retweets ", "ON", "OFF");
    createToggleOption(sidePanel, toggleTopics, false, "Topic Tweets ", "ON", "OFF");
    createToggleOption(sidePanel, toggleClearTopics, false, "Interests/Topics Prefs AutoClear ", "ON", "OFF");
    createToggleOption(sidePanel, toggleTimelineScaling, true, "Timeline Width Scaling ", "ON", "OFF");
    createToggleOption(sidePanel, toggleAnalyticsDisplay, false, "Show Post Views ", "ON", "OFF");
}

async function createToggleOption(sidePanel, toggleState, defaultValue, toggleText, toggleOnText, toggleOffText)
{
    toggleState.enabled = await getUserPref(toggleState.name, defaultValue);
    toggleState.elem = sidePanel.querySelector('#' + toggleState.name);
    toggleOnText = toggleText + toggleOnText;
    toggleOffText = toggleText + toggleOffText;
    if (toggleState.elem == null)
    {
        toggleState.elem = createToggleButton(toggleState.enabled ? toggleOnText : toggleOffText, toggleState.name);
        toggleState.elem.style.marginTop = "0.4em";
        toggleState.elem.style.marginBottom = "0.1em";
        toggleState.elem.style.marginRight = "1em";
        toggleState.elem.style.marginLeft = "1em";
        toggleState.elem.style.outlineStyle = "solid";
        toggleState.elem.style.outlineWidth = "0.02em";
        toggleState.elem.addEventListener('click', (e) =>
        {
            toggleState.enabled = toggleState.enabled ? false : true;
            setUserPref(toggleState.name, toggleState.enabled);
            toggleState.onChanged.dispatchEvent(new CustomEvent(toggleState.name, {'detail':{'toggle':toggleState}}));
            toggleState.elem.innerHTML = toggleState.enabled ? toggleOnText : toggleOffText;
        });

        const footer = sidePanel.querySelector('nav').parentElement.appendChild(toggleState.elem);
    }
}

var blurShowText = "";

async function processBlurButton(tweet)
{

    const getBlurText = function(blur)
    {
        return blur.querySelector('span > span').innerText;
    }

    const blurBtn = tweet.querySelector('div[role="button"][style^="backdrop-filter: blur"]');
    if(blurBtn != null)
    {
        if(blurShowText == "")
        {
            blurShowText = getBlurText(blurBtn);
        }
        if(!toggleNSFW.enabled)
        {
            blurBtn.click();
        }
        blurBtn.style.display = toggleNSFW.enabled ? "block" : "none";


        watchForChange(tweet, {attributes: false, childList: true, subtree: true}, (blurParent, mutes) => {

            const curBlur = blurParent.querySelector('div[role="button"][style^="backdrop-filter: blur"]');
            if(curBlur == null) { return; }

            if(!toggleNSFW.enabled && getBlurText(curBlur) == blurShowText)
            {
                curBlur?.click();
            }

            curBlur.style.display = toggleNSFW.enabled ? "block" : "none";
            let span = curBlur.querySelector('span > span');

            if(!addHasAttribute(curBlur, modifiedAttr))
            {
                watchForChange(curBlur, {attributes:true, characterData: true, childList: true, subtree: true}, (blur, mutes) => {
                    curBlur.style.display = toggleNSFW.enabled ? "block" : "none";
                });
                toggleNSFW.onChanged.addEventListener("nsfwToggleChanged", function(enabled) {
                    curBlur?.click();
                    curBlur.style.display = enabled ? "block" : "none";
                });
            }

        });
    }
}

async function setupTrendingControls(trendingBox)
{
    const showStr = "Show";
    const hideStr = "Hide";

    const setTrendingVisible = function (container, button, hidden)
    {
        container.style.maxHeight = hidden ? "44px" : "none";
        button.innerText = hidden ? showStr : hideStr;
        setUserPref(usePref_hideTrendingKey, hidden);
    };

    let trendingTitle = await awaitElem(trendingBox, 'h2', argsChildAndSub);

    if (!addHasAttribute(trendingTitle, modifiedAttr))
    {
        let toggle = trendingTitle.querySelector('#thd_toggleTrending');

        if (toggle == null)
        {
            toggle = createToggleButton(hideStr, "thd_toggleTrending");
            toggle.addEventListener('click', (e) =>
            {
                var isHidden = toggle.innerText == hideStr;
                setTrendingVisible(trendingBox, toggle, isHidden);
            });
            trendingTitle.appendChild(toggle);
        }
        getUserPref(usePref_hideTrendingKey, true).then((visible) =>
        {
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
    if (mutation.addedNodes != null && mutation.addedNodes.length > 0)
    {
        const contentContainer = Array.from(mutation.addedNodes)[0];
        const dialog = await awaitElem(contentContainer, 'div[role="dialog"]', argsChildAndSub);
        const img = await awaitElem(dialog, 'img[alt="Image"]', argsChildAndSub);
        const list = dialog.querySelector('ul[role="list"]');
        let tweetInfo = await getTweetInfo(img);

        if (list != null /* && !addHasAttribute(list, 'thd_modified')*/ )
        {
            const listItems = list.querySelectorAll('li');
            const itemCnt = listItems.length;

            for (let i = 0; i < itemCnt; i++)
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
  //  if (addHasAttribute(img, "thd_modified")) { return; }
    let bg = img.parentElement.querySelector('div');
    let hqSrc = getHighQualityImage(img.src);
    addCustomCtxMenu(img, hqSrc, tweetInfo, img);
    updateImgSrc(img, bg, hqSrc);
    doOnAttributeChange(img, (imgElem) => { updateImgSrc(imgElem, bg, hqSrc); }, false);
}

//<--> RIGHT-CLICK CONTEXT MENU STUFF START <-->//

const ctxMenu = document.createElement('div');
ctxMenu.style.zIndex = "500";
ctxMenu.id = "contextMenu";
ctxMenu.className = "context-menu";
setContextMenuVisible(false);

const ctxMenuList = document.createElement('ul');
//ctxMenuList.style.zIndex = 500;
ctxMenu.appendChild(ctxMenuList);

const ctxMenuOpenInNewTab = createCtxMenuItem(ctxMenuList, "Open Image in New Tab");
const ctxMenuOpenVidInNewTab = createCtxMenuItem(ctxMenuList, "Open Video in New Tab");
const ctxMenuSaveAs = createCtxMenuItem(ctxMenuList, "Save Image As");
const ctxMenuSaveAsVid = createCtxMenuItem(ctxMenuList, "Save Video As");
const ctxMenuCopyImg = createCtxMenuItem(ctxMenuList, "Copy Image");
const ctxMenuCopyAddress = createCtxMenuItem(ctxMenuList, "Copy Image Link");
const ctxMenuCopyVidAddress = createCtxMenuItem(ctxMenuList, "Copy Video Link");
const ctxMenuGRIS = createCtxMenuItem(ctxMenuList, "Search Google for Image");
const ctxMenuShowDefault = createCtxMenuItem(ctxMenuList, "Show Default Context Menu");

document.body.appendChild(ctxMenu);
document.body.addEventListener('click', function (e) { setContextMenuVisible(false); });

function createCtxMenuItem(menuList, text)
{
    let menuItem = document.createElement('LI');
    menuItem.innerText = text;
    menuList.appendChild(menuItem);
    return menuItem;
}

function mouseX(evt)
{
    if (evt.pageX)
    {
        return evt.pageX;
    }
    else if (evt.clientX)
    {
        return evt.clientX + (document.documentElement.scrollLeft ?
            document.documentElement.scrollLeft :
            document.body.scrollLeft);
    }
    else
    {
        return null;
    }
}

function mouseY(evt)
{
    if (evt.pageY)
    {
        return evt.pageY;
    }
    else if (evt.clientY)
    {
        return evt.clientY + (document.documentElement.scrollTop ?
            document.documentElement.scrollTop :
            document.body.scrollTop);
    }
    else
    {
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

async function updateContextMenuLink(dlURL, tweetInfo, media)
{
    if(media == null) { return; }

    ctxMenu.setAttribute('selection', dlURL);

    let isImage = media.tagName.toLowerCase() == "img";

    let imgVisibility = isImage ? "block" : "none";
    let vidVisibility = isImage ? "none" : "block";

    ctxMenuOpenInNewTab.style.display = imgVisibility;
    ctxMenuSaveAs.style.display = imgVisibility;
    ctxMenuCopyImg.style.display = imgVisibility;
    ctxMenuCopyAddress.style.display = imgVisibility;
    ctxMenuGRIS.style.display = imgVisibility;

    ctxMenuOpenVidInNewTab.style.display = vidVisibility;
    ctxMenuSaveAsVid.style.display = vidVisibility;
    ctxMenuCopyVidAddress.style.display = vidVisibility;

    const saveMedia = function(url){ setContextMenuVisible(false); download(url, filenameFromTweetInfo(tweetInfo)) };
    const copyAddress = function(url){ setContextMenuVisible(false); navigator.clipboard.writeText(url); };
    const openInNewTab = function(url)
    {
        setContextMenuVisible(false);
        if (GM_OpenInTabMissing)
        {
            var lastWin = window;
            window.open(url, '_blank');
            lastWin.focus();
        }
        else { GM_openInTab(url, { active: false, insert: true, setParent: true, incognito: false }); }
    };


    //Image Context
    if(isImage == true)
    {
        media.crossOrigin = 'Anonymous'; //Needed to avoid browser preventing the Canvas from being copied when doing "Copy Image"

        ctxMenuOpenInNewTab.onclick = () => { openInNewTab(dlURL) };
        ctxMenuSaveAs.onclick = () => { saveMedia(dlURL) };

        ctxMenuCopyImg.onclick = () =>
        {
            setContextMenuVisible(false);
            try
            {
                let c = document.createElement('canvas');
                c.width = media.naturalWidth;
                c.height = media.naturalHeight;
                c.getContext('2d').drawImage(media, 0, 0, media.naturalWidth, media.naturalHeight);
                c.toBlob((png) =>
                         {
                    navigator.clipboard.write([new ClipboardItem({
                        [png.type]: png })]);
                }, "image/png", 1);
            }
            catch (err) { console.log(err); };
        };
        ctxMenuCopyAddress.onclick = () => { copyAddress(dlURL) };
        ctxMenuGRIS.onclick = () => { setContextMenuVisible(false);
                                     window.open("https://images.google.com/searchbyimage?image_url=" + dlURL); };
    }
    else //Video
    {
        ctxMenuOpenVidInNewTab.onclick = () => { openInNewTab(dlURL) };
        ctxMenuSaveAsVid.onclick = () => { saveMedia(dlURL) };
        ctxMenuCopyVidAddress.onclick = () => { copyAddress(dlURL) };
    }

    //Generic Stuff
    ctxMenuShowDefault.onclick = () => { selectedShowDefaultContext = true;
        setContextMenuVisible(false); };
}

function addCustomCtxMenu(elem, dlLink, tweetInfo, media)
{
    if (addHasAttribute(elem, "thd_customctx")) { return; }
    elem.addEventListener('contextmenu', function (e)
    {
        e.stopPropagation();

        let curSel = ctxMenu.getAttribute('selection');


        if (wasShowDefaultContextClicked()) { selectedShowDefaultContext = false; return; } //Skip everything here and show default context menu
        if(ctxMenu.style.display != "block" ||
        (ctxMenu.style.display == "block" && (curSel == null ||
                                              (curSel != null && curSel != dlLink))))
        {
            updateContextMenuLink(dlLink, tweetInfo, media);
            setContextMenuVisible(true);
            ctxMenu.style.left = mouseX(e) + "px";
            ctxMenu.style.top = mouseY(e) + "px";
            e.preventDefault();
        }
        else
        {
            e.preventDefault();
            setContextMenuVisible(false);
        }

    }, false);
}

//<--> TWITTER UTILITY FUNCTIONS <-->//

//Because Firefox doesn't assume the format unlike Chrome...
function getMediaFormat(url)
{
    let end = url.split('/').pop();
    let periodSplit = end.split('.');
    if (periodSplit.length > 1)
    {
        return '.' + periodSplit.pop().split('?')[0];
    }
    if (url.includes('format='))
    {
        let params = url.split('?').pop().split('&');
        for (let p = 0; p < params.length; p++)
        {
            if (params[p].includes('format'))
            {
                return '.' + params[p].split('=').pop().split('?')[0];
            }
        }
    }

    return '';
}

function isDirectImagePage(url) //Checks if webpage we're on is a direct image view
{
    if (url.includes('/media/') && url.includes('format=') && url.includes('name='))
    {
        if (!url.includes('name=orig'))
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
    GM_download(
    {
        name: filename + getMediaFormat(url),
        url: url,
        onload: function () { /*LogMessage(`Downloaded ${url}!`);*/ }
    });
}

function getIDFromPoster(poster)
{
    return poster.split('thumb/')[1].split('/')[0];
}

function getUrlFromTweet(tweet)
{
    let curUrl = window.location.href;
    if (curUrl.includes('/photo/') || curUrl.includes('/status/')) { return curUrl; } //Probably viewing full-screen image


    let article = tweet.tagName.toUpperCase() == 'ARTICLE' ? tweet : tweet.closest('article');

    if (article == null) { return null; }

    let postLink = article.querySelector('a:not([href*="/retweets"],[href$="/likes"])[href*="/status/"][role="link"][dir="auto"]');
    let imgLink = article.querySelector('a:not([href*="/retweets"],[href$="/likes"],[dir="auto"])[href*="/status/"][role="link"]');

    if (imgLink)
    {
        let statusLink = imgLink.href.split('/photo/')[0];
        let imgUser = statusLink.split('/status/')[0];
        if (postLink == null || !postLink.href.includes(imgUser)) { return statusLink; }
    }

    if (postLink) { return postLink.href; }

    if (curUrl.includes('/status/')) { return curUrl; } //Last resort, not guranteed to actually be for the element in the timeline we are processing
    return null;
}

function getIDFromTweet(tweet)
{
    let url = getUrlFromTweet(tweet);
    return getIDFromURL(url);
}

function getIDFromURL(url)
{
    url = url.split('?')[0].split('/photo/')[0];
    let urlSplit = url.split('/status/');
    let id = urlSplit[1].split('/')[0];

    return id;
}

async function getTweetInfo(tweet)
{
    let link = getUrlFromTweet(tweet);
    if (link == null) { return null; }
    //LogMessage(link);

    let url = link.split('?')[0];
    let photoUrl = url.split('/photo/');
    url = photoUrl[0];
    let urlSplit = url.split('/status/');

    let id = urlSplit[1].split('/')[0];

    let subTweet = tweet.querySelector('div[data-testid="tweetPhoto"] div[tabindex]');

    if(subTweet != null && subTweet.getAttribute('tabindex') == "-1")
    {
        let subLink = await getLinkFromPoster(id);
        if(subLink != null)
        {
           // console.log(subLink);
            url = subLink.split('?')[0];
            photoUrl = url.split('/photo/');
            url = photoUrl[0];
            urlSplit = url.split('/status/');
            id = urlSplit[1].split('/')[0];
        }
    }

    let username = urlSplit[0].split('/').pop();
    let attributeTo = tweet.querySelector('div[aria-label]');
    let elementIndex = -1;
    if (photoUrl.length > 1) { elementIndex = parseInt(photoUrl[1]);
        LogMessage(url + " : " + photoUrl[1]); }

    return { id: id, url: url, username: username, elemIndex: elementIndex, elem: tweet }
}

function filenameFromTweetInfo(tweetInfo)
{
    let filename = tweetInfo.username + ' - ' + tweetInfo.id;
    if (tweetInfo.elemIndex >= 0) { filename += '_' + tweetInfo.elemIndex.toString(); }
    return filename;
}

function getHighQualityImage(url)
{
    return url.replace(/(?<=[\&\?]name=)([A-Za-z0-9])+(?=\&)?/, 'orig');
}

function tryGetVidLocal(vidElem, id, matchID)
{
    if(vidElem != null && vidElem.tagName.toLowerCase() != "video")
    {
        vidElem = vidElem.querySelector('video');
    }
    if(vidElem != null)
    {
        let src = vidElem.src;
        if(src.includes('/tweet_video/'))
        {
            return src;
        }
    }

    return vids.get(id + ((matchID != null) ? matchID : ""));
}

const fetchURL = "https://api.twitter.com/1.1/statuses/show.json?skip_status=1&include_entities&cards_platform=Web-12&tweet_mode=extended&trim_user=true&id=";

function initFetch()
{
    let init = {
            origin: 'https://twitter.com',
            headers:
            {
                "Accept": '*/*',
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0",
                "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
                "x-csrf-token": cooky,
            },
            credentials: 'include',
            referrer: 'https://twitter.com'
        };

    return init;
}

var clearedTopics = false;

async function clearTopicsAndInterests(force = false)
{
    if(!force && clearedTopics) { return; }
    clearedTopics = true;

    let autoClear = await getUserPref(toggleClearTopics.name, false);
    if(autoClear == false && force == false) { return; }

    let lastClearTimeText = await getUserPref(usePref_lastTopicsClearTime, "16");
    let lastClearTime = parseInt(lastClearTimeText);
    let curTime = Date.now();

    if(curTime - lastClearTime < 86400000 || curTime == lastClearTime)
    {
        return;
    }

    await setUserPref(usePref_lastTopicsClearTime, curTime.toString());


    fetch("https://twitter.com/i/api/1.1/account/personalization/twitter_interests.json", {
        "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-csrf-token": cooky,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en"
        },
        "referrer": "https://twitter.com/settings/your_twitter_data/twitter_interests",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    }).then(function(response) {
        if(response.status == 200)
        {
            response.json().then((json) => {

                fetch("https://twitter.com/i/api/1.1/account/personalization/p13n_preferences.json",
                      {
                    "headers": {
                        "accept": "*/*",
                        "accept-language": "en-US,en;q=0.9",
                        "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                        "x-csrf-token": cooky,
                        "x-twitter-active-user": "yes",
                        "x-twitter-auth-type": "OAuth2Session",
                        "x-twitter-client-language": "en"
                    },
                    "referrer": "https://twitter.com/settings/your_twitter_data/twitter_interests",
                    "referrerPolicy": "strict-origin-when-cross-origin",
                    "body": null,
                    "method": "GET",
                    "mode": "cors",
                    "credentials": "include"
                }).then((response) =>
                {
                    if(response.status == 200)
                    {
                        response.json().then((prefs) =>
                        {
                            const interests = json.interested_in;
                            if(interests.length == 0) { return; }
                            const disinterests = prefs.interest_preferences.disabled_interests;
                            prefs.allow_ads_personalization = false;
                            prefs.use_cookie_personalization = false;
                            prefs.is_eu_country = true;
                            prefs.age_preferences.use_age_for_personalization = false;
                            prefs.gender_preferences.use_gender_for_personalization = false;

                            for(let i = 0; i < interests.length; i++)
                            {
                                disinterests.push(interests[i].id);
                            }

                            prefs.interest_preferences.disabled_interests = disinterests;

                            fetch("https://twitter.com/i/api/1.1/account/personalization/p13n_preferences.json", {
                                "headers": {
                                    "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
                                    "content-type": "application/json",
                                    "x-csrf-token": cooky,
                                    "x-twitter-active-user": "yes",
                                    "x-twitter-auth-type": "OAuth2Session",
                                    "x-twitter-client-language": "en"
                                },
                                "referrer": "https://twitter.com/settings/your_twitter_data/twitter_interests",
                                "referrerPolicy": "strict-origin-when-cross-origin",
                                "body": `{"preferences":${JSON.stringify(prefs)}}`,
                                "method": "POST",
                                "mode": "cors",
                                "credentials": "include"
                            });
                        });
                    }
                });

            });
        }
    });

    fetch("https://twitter.com/i/api/graphql/Lt9WPkNBUP-LtG_OPW9FkA/TopicsManagementPage?variables=%7B%22withSuperFollowsUserFields%22%3Afalse%2C%22withDownvotePerspective%22%3Afalse%2C%22withReactionsMetadata%22%3Afalse%2C%22withReactionsPerspective%22%3Afalse%2C%22withSuperFollowsTweetFields%22%3Atrue%7D&features=%7B%22responsive_web_twitter_blue_verified_badge_is_enabled%22%3Afalse%2C%22verified_phone_label_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22unified_cards_ad_metadata_container_dynamic_card_content_query_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_uc_gql_enabled%22%3Atrue%2C%22vibe_api_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Afalse%2C%22interactive_text_enabled%22%3Atrue%2C%22responsive_web_text_conversations_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Atrue%7D", {
        "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
            "content-type": "application/json",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-csrf-token": cooky,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en"
        },
        "referrer": "https://twitter.com/invert_x/topics/followed",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    }).then((resp) => {
        if(resp.status == 200)
        {
            resp.json().then((topics) => {
                let items = topics.data.viewer.topics_management_page.body.initialTimeline.timeline.timeline.instructions[2].entries;

                for(let t = 0; t < items.length; t++)
                {
                    let item = items[t];
                    if(item.content.clientEventInfo.component == "suggest_followed_topic" && item.content.itemContent.topic.following == true)
                    {
                       fetch("https://twitter.com/i/api/graphql/srwjU6JM_ZKTj_QMfUGNcw/TopicUnfollow", {
                            "headers": {
                                "accept": "*/*",
                                "accept-language": "en-US,en;q=0.9",
                                "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
                                "content-type": "application/json",
                                "sec-fetch-dest": "empty",
                                "sec-fetch-mode": "cors",
                                "sec-fetch-site": "same-origin",
                                "x-csrf-token": cooky,
                                "x-twitter-active-user": "yes",
                                "x-twitter-auth-type": "OAuth2Session",
                                "x-twitter-client-language": "en"
                            },
                            "body": `{"variables":{"topicId":"${item.content.itemContent.topic.topic_id}"},"queryId":""}`,
                            "method": "POST",
                            "mode": "cors",
                            "credentials": "include"
                        });
                    }
                }
            });
        }
    });
}

async function bookmarkPost(postId)
{
    fetch("https://api.twitter.com/graphql/aoDbu3RHznuiSkQ9aNM67Q/CreateBookmark", {
        "headers": {
            "accept": "*/*",
            "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
            "content-type": "application/json",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "x-csrf-token": cooky,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en"
        },
        "referrer": "https://twitter.com/",
      //  "referrerPolicy": "strict-origin-when-cross-origin",
        "body": `{"variables":{"tweet_id":"${postId}"},"queryId":"aoDbu3RHznuiSkQ9aNM67Q"}`,
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    });
}

function getLinkFromPoster(tweetId)
{
    return new Promise((resolve, reject) =>
   {
        var init = initFetch();

        try
        {
            fetch(fetchURL + tweetId, init).then(function (response)
            {
                if (response.status == 200)
                {
                    response.json().then(function(json)
                    {
                        if(json.is_quote_status == true)
                        {
                            resolve(json.entities.urls[0].expanded_url);
                            return;
                        }
                        resolve(null);
                        return;
                    });
                }
                else { resolve(null); }
            }).catch((err) => { reject({ error: err });
                               resolve(null); });
        }
        catch (err) { resolve(null); }
    });
}

function getVidURL(id, vidElem, matchId)
{
    return new Promise((resolve, reject) =>
    {
        let vidSrc = tryGetVidLocal(vidElem, id, matchId);
        if(vidSrc != null) { resolve(vidSrc); return; }

        let init = initFetch();

        try
        {
            fetch(fetchURL + id, init).then(function (response)
            {
                if (response.status == 200)
                {
                    response.json().then(function (json)
                    {
                        let entities = json.extended_entities;
                        if (entities == undefined || entities == null || entities.media == null) { resolve(null); return; }

                        let mediaIndex = 0;

                        if(matchId != null && matchId != "")
                        {

                             for(let i = 0; i < entities.media.length; i++)
                             {
                                 if(entities.media[i].id_str == matchId)
                                 {
                                     mediaIndex = i;
                                     break;
                                 }
                             }
                        }
                        let vid = entities.media[mediaIndex];

                        if(vid.video_info != null)
                        {
                            let mp4Variants = vid.video_info.variants.filter(variant => variant.content_type === 'video/mp4');
                            mp4Variants = mp4Variants.sort((a, b) => (b.bitrate - a.bitrate));
                            if(mp4Variants.length)
                            {
                                let url = mp4Variants[0].url;
                                vids.set(id + (matchId != null ? matchId : ""), url);
                                resolve(url);
                                return;
                            }
                            resolve(null);
                        }
                        return;
                    });
                }
                else { resolve(null); }
            }).catch((err) => { reject({ error: err });
                resolve(null); });
        }
        catch (err) { resolve(null); }
    });
}

//<--> GENERIC UTILITY FUNCTIONS <-->//
async function watchForChange(root, obsArguments, onChange)
{
    const rootObserver = new MutationObserver(function (mutations)
    {
        mutations.forEach((mutation) => onChange(root, mutation));
    });
    rootObserver.observe(root, obsArguments);
}

async function watchForAddedNodes(root, stopAfterFirstMutation, obsArguments, executeAfter)
{
    const rootObserver = new MutationObserver(
        function (mutations)
        {
            //  LogMessage("timeline mutated");
            mutations.forEach(function (mutation)
            {
                if (mutation.addedNodes == null || mutation.addedNodes.length == 0) { return; }
                if (stopAfterFirstMutation) { rootObserver.disconnect(); }
                executeAfter(mutation.addedNodes);
            });

        });

    rootObserver.observe(root, obsArguments);
}

function findElem(rootElem, query, observer, resolve)
{
    const elem = rootElem.querySelector(query);
    if (elem != null && elem != undefined)
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
        if (findElem(root, query, null, resolve)) { return; }
        const rootObserver = new MutationObserver((mutes, obs) => { findElem(root, query, obs, resolve); });
        rootObserver.observe(root, obsArguments);
    });
}

function doOnAttributeChange(elem, onChange, repeatOnce = false)
{
    let rootObserver = new MutationObserver((mutes, obvs) =>
    {
        obvs.disconnect();
        onChange(elem);
        if (repeatOnce == true) { return; }
        obvs.observe(elem, { childList: false, subtree: false, attributes: true })
    });
    rootObserver.observe(elem, { childList: false, subtree: false, attributes: true });
}

function addHasAttribute(elem, attr)
{
    if (elem.hasAttribute(attr)) { return true; }
    elem.setAttribute(attr, "");
    return false;
}

function getCookie(name)
{
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) { return match[2].toString(); }
    return null;
}

function getCSSRuleContainingStyle(styleName, selectors, styleCnt = 0, matchingValue = "")
{
    var sheets = document.styleSheets;
    for (var i = 0, l = sheets.length; i < l; i++)
    {
        var curSheet = sheets[i];

        if (!curSheet.cssRules) { continue; }

        for (var j = 0, k = curSheet.cssRules.length; j < k; j++)
        {
            var rule = curSheet.cssRules[j];
            if (styleCnt != 0 && styleCnt != rule.style.length) { return null; }
            if (rule.selectorText && rule.style.length > 0 /* && rule.selectorText.split(',').indexOf(selector) !== -1*/ )
            {
                for (var s = 0; s < selectors.length; s++)
                {
                    if (rule.selectorText.includes(selectors[s]) && rule.style[0] == styleName)
                    {
                        if (matchingValue === "" || matchingValue == rule.style[styleName])
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
    if (isGM) { return await GM.getValue(key, defaultVal); }
    return await GM_getValue(key, defaultVal);
}
async function setUserPref(key, value)
{
    if (isGM) { return await GM.setValue(key, value); }
    return await GM_setValue(key, value);
}

function LogMessage(text) { /*console.log(text);*/ }

function addGlobalStyle(css)
{
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
    getUserPref(usePref_blurNSFW, false).then((res) => { toggleNSFW.enabled = res; });
}

(async function ()
{
    'use strict';
    if (isDirectImagePage(window.location.href)) { return; }

    NodeList.prototype.forEach = Array.prototype.forEach;
    LoadPrefs();
    await awaitElem(document, 'BODY', argsChildAndSub);
    let isIframe = document.body.querySelector('div#app');

    if (isIframe != null)
    {
        awaitElem(isIframe, 'article[role="article"]', argsChildAndSub).then(listenForMediaType);
        return;
    }
    const reactRoot = await awaitElem(document.body, 'div#react-root', argsChildAndSub);
    const main = await awaitElem(reactRoot, 'main[role="main"] div', argsChildAndSub);

    let layers = reactRoot.querySelector('div#layers');

    awaitElem(reactRoot, 'div#layers', argsChildAndSub).then((layers) =>
    {
        if (!addHasAttribute(layers, "watchingLayers")) { watchForChange(layers, { childList: true, subtree: true }, onLayersChange); }
    });

    addHasAttribute(main, modifiedAttr);
    await loadToggleValues();
    onMainChange(main);
    watchForChange(main, argsChildOnly, onMainChange);
})();
