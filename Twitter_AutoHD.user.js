// ==UserScript==
// @name         Twitter AutoHD
// @namespace    Invertex
// @version      2.80
// @description  Forces whole image to show on timeline with bigger layout for multi-image. Forces videos/images to show in highest quality and adds a download button and right-click for content that ensures an organized filename. As well as other improvements.
// @author       Invertex
// @updateURL    https://github.com/Invertex/Twitter-AutoHD/raw/master/Twitter_AutoHD.user.js
// @downloadURL  https://github.com/Invertex/Twitter-AutoHD/raw/master/Twitter_AutoHD.user.js
// @icon         https://i.imgur.com/M9oO8K9.png
// @match        https://*.twitter.com/*
// @match        https://*.twimg.com/media/*
// @match        https://*.x.com/*
// @match        https://*.fixupx.com/*
// @match        https://*.vxtwitter.com/*
// @match        https://*.fxtwitter.com/*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant unsafeWindow
// @grant GM_setValue
// @grant GM_getValue
// @grant GM.setValue
// @grant GM.getValue
// @run-at document-start
// @require https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// ==/UserScript==

const cooky = getCookie("ct0"); //Get our current Twitter session token so we can use Twitter API to request higher quality content
const modifiedAttr = "THD_modified";
const GM_OpenInTabMissing = (typeof GM_openInTab === 'undefined');

var tweets = new Map(); //Cache intercepted tweets data
///
const argsChildAndSub = { attributes: false, childList: true, subtree: true };
const argsChildOnly = { attributes: false, childList: true, subtree: false };
const argsChildAndAttr = { attributes: true, childList: true, subtree: false };
const argsAll = { attributes: true, childList: true, subtree: true };
const argsAttrOnly = { attributes: true, childList: false, subtree: false };

const dlSVG = '<g><path d="M 8 51 C 5 54 5 48 5 42 L 5 -40 C 5 -45 -5 -45 -5 -40 V 42 C -5 48 -5 54 -8 51 L -48 15 C -51 12 -61 17 -56 22 L -12 61 C 0 71 0 71 12 61 L 56 22 C 61 17 52 11 48 15 Z"></path>' +
    '<path d="M 56 -58 C 62 -58 62 -68 56 -68 H -56 C -62 -68 -62 -58 -56 -58 Z"></path></g>';

const twitSVG = '<g><path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 '+
      '0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 '+
      '4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 '+
      '2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"></path></g>';

const bookmarkSVG = '<g><path d="M17 3V0h2v3h3v2h-3v3h-2V5h-3V3h3zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V11h2v11.94l-8-5.71-8 5.71V4.5C4 3.12 5.119 2 6.5 2h4.502v2H6.5z"></path></g>';
const unbookmarkSVG = '<g><path d="M16.586 4l-2.043-2.04L15.957.54 18 2.59 20.043.54l1.414 1.42L19.414 4l2.043 2.04-1.414 1.42L18 5.41l-2.043 2.05-1.414-1.42L16.586 '
+'4zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V11h2v11.94l-8-5.71-8 5.71V4.5C4 3.12 5.119 2 6.5 2h4.502v2H6.5z"></path></g>';

addGlobalStyle(`@-webkit-keyframes spin { 0% { -webkit-transform: rotate(0deg); transform: rotate(0deg); } 100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); } }
@keyframes spin { 0% { -webkit-transform: rotate(0deg); transform: rotate(0deg); } 100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); } }
.loader { border: 16px solid #f3f3f373; display: -webkit-box; display: -ms-flexbox; display: flex; margin: auto; border-top: 16px solid #3498db99; border-radius: 50%; width: 120px; height: 120px; -webkit-animation: spin 2s linear infinite; animation: spin 2s linear infinite;}
.context-menu { position: absolute; text-align: center; margin: 0px; background: #040404; border: 1px solid #0e0e0e; border-radius: 5px;}
.context-menu ul { padding: 0px; margin: 0px; min-width: 190px; list-style: none;}
.context-menu ul li { padding-bottom: 7px; padding-top: 7px; border: 1px solid #0e0e0e; color:#c1bcbc; font-family: sans-serif; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;}
.context-menu ul li:hover { background: #202020;}
a[aria-label="Grok"], div > aside[aria-label*="Premium"], div[data-testid="inlinePrompt"]:has(div > a[href^="/i/premium_sign_up"]),
               div:has(> div > div[data-testid="bookmark"], > div > div[data-testid="removeBookmark"]) > div#thd_button_Bookmark { display: none !important; }
.thd_settings_collapsible { background-color:rgb(28, 30, 34); color:rgb(180, 183, 173); cursor:pointer; width:100%; border:none; text-align:left; outline:none; font-size:15px; border-radius:11px 11px 0 0; padding: 8px 14px 8px}
.thd_settings_collapsible:after { content: "Show \u2795"; font-size: 13px; float: right; margin-left: 5px; }
.thd_settings_active, .thd_settings_collapsible:hover { background-color:rgb(38, 40, 44); }
.thd_settings_active:after { content: "Hide \u2796"; }
.thd_settings_content{ overflow:hidden; background-color:rgb(22, 24, 28); -webkit-box-orient: vertical; -webkit-box-direction: normal; -ms-flex-flow: column; flex-flow: column; display: -webkit-box; display: -ms-flexbox; display: flex; padding-bottom: 6px; }
              .thd_settings_content_closed { display: none !important; }
.thd_settings_toggle { margin: 0.01em 0.4em 0.01em; border-style: solid; border-width: 0.015em; border-color: #101010; background-color: #202020; border-radius:6px; color: rgb(100, 100, 100); }
.thd_settings_toggle:hover { background-color: #393838; border-width: 0.045em; border-color: #505050; cursor:pointer; color: rgb(210, 210 210); }
.thd_settings_toggle_enabled { background-color: #292828; border-width: 0.045em; border-color: #404040; cursor:pointer; color: rgb(190, 190, 190); }
`);

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

const filterVideoSources = function (m3u8)
{
    const regex = /(?<=,RESOLUTION=)(.*)(?=x)/gm;
    const regexAudio = /(?<=GROUP-ID="audio-)(.*)(?=",)/gm;
    let bestLine = 0;
    let bestAudioLine = 0;
    let bestResolution = 0;
    let bestAudioBandwith = 0;
    let avc1FallbackVideo = 0;

    sb.clear();

    let lines = m3u8.split('#');

    sb.append(lines[0]);

    for (let i = 1; i < lines.length; i++)
    {
        let line = lines[i];

        if (line.includes('STREAM-INF:'))
        {
            let resolution = parseInt(line.match(regex));
            if (resolution > bestResolution)
            {
                bestResolution = resolution;
                bestLine = i;
            }
            else if (bestLine === 0) { bestLine = i; } //failsafe in case something breaks with parsing down the line
            //Twitter serves HEVC now and leaves just one low res avc1 fallback, so don't remove that fallback just in case...
            if(line.includes('/avc1/')) { avc1FallbackVideo = i; }
        }
        else if (lines[i].includes('EXT-X-MEDIA:NAME="Audio"'))
        {
            let bandwidth = parseInt(line.match(regexAudio));

            if (bandwidth > bestAudioBandwith)
            {
                bestAudioBandwith = bandwidth;
                bestAudioLine = i;
            }
            else if (bestAudioLine === 0) { bestAudioLine = i; } //failsafe in case something breaks with parsing down the line
        }
        else
        {
            sb.append('#' + lines[i]);
        }
    }

    let doAVC1Fallback = bestLine > 0 && !lines[bestLine].includes('/avc1/') && avc1FallbackVideo > 0;

    if (bestAudioLine > 0)
    {
        sb.append('#' + lines[bestAudioLine]);

        if (doAVC1Fallback)
        {
            let avcLine = lines[avc1FallbackVideo];
            let index = avcLine.indexOf('AUDIO="') + 7;

            if(index > 8)
            {
                let audioGroup = avcLine.substr(index).split('"')[0];
                for (let i = 1; i < lines.length; i++)
                {
                    let line = lines[i];
                    if(line.includes('TYPE=AUDIO') && line.includes(audioGroup))
                    {
                        sb.append('#' + line);
                        break;
                    }
                }
            }
        }
    }


    if (bestLine > 0)
    {
        sb.append('#' + lines[bestLine]);
        if (doAVC1Fallback) { sb.append('#' + lines[avc1FallbackVideo]); }
    }

    return sb.toString();
};


// Intercept relevant keys used by API so we can use the API too
var transactID = "";
var authy = "";

var oldReqHead = unsafeWindow.XMLHttpRequest.prototype.setRequestHeader;
unsafeWindow.XMLHttpRequest.prototype.setRequestHeader = exportFunction(function(name, value)
{
    if(name == "X-Client-Transaction-Id")
    {
        transactID = value;
    }
    else if(name == "authorization")
    {
        authy = value;
    }
    oldReqHead.call(this, name, value);
}, unsafeWindow);


//Intercept the Timeline to pre-cache information about tweets and filter out unwanted tweets
var openOpen = unsafeWindow.XMLHttpRequest.prototype.open;
unsafeWindow.XMLHttpRequest.prototype.open = exportFunction(function(method, url)
{
    processXMLOpen(this, method, url);
    openOpen.call(this, method, url);
}, unsafeWindow);


function processXMLOpen(thisRef, method, url)
{
    if(prefsLoaded === false) {
        loadToggleValues();
    }

    if ((url.includes('video.twimg.com') || url.includes('master_dynamic')) && url.includes('.m3u8?'))
    {
        thisRef.addEventListener('readystatechange', function (e)
        {
            if (toggleHQVideo.enabled && thisRef.readyState === 4)
            {
                const m3uText = e.target.responseText;
                if(!m3uText.includes('#EXT-X-MEDIA-SEQUENCE'))
                {
                    const m3u = filterVideoSources(m3uText);

                    Object.defineProperty(thisRef, 'response', { writable: true });
                    Object.defineProperty(thisRef, 'responseText', { writable: true });
                    thisRef.response = thisRef.responseText = m3u;
                }
            }
        });
    }
    else if(url.includes('show.json?'))
    {
        thisRef.addEventListener('readystatechange', function (e)
        {
            if (toggleHQVideo.enabled && thisRef.readyState === 4)
            {
                let json = JSON.parse(e.target.response);
                let vidInfo = json.extended_entities?.media?.video_info ?? null;

                if(vidInfo != null && vidInfo.variants != null && vidInfo.variants.length > 2)
                {
                    vidInfo.variants = stripVariants(vidInfo.variants, true);
                    Object.defineProperty(thisRef, 'response', { writable: true });
                    Object.defineProperty(thisRef, 'responseText', { writable: true });

                    thisRef.response = thisRef.responseText = JSON.stringify(json);
                }
            }
        });
    }
    else if(url.includes("/graphql/") /*&& (url.includes('/Home') || url.includes('includePromotedContent') || url.includes('ListLatestTweetsTimeline') || url.includes('/UserMedia') || url.includes('/UserTweetsAndReplies?')|| url.includes('/Likes?'))*/)
    {
        url = url.replace('includePromotedContent%22%3Atrue', 'includePromotedContent%22%3Afalse');
        url = url.replace('phone_label_enabled%22%3Afalse', 'phone_label_enabled%22%3Atrue');
        url = url.replace('reach_fetch_enabled%22%3Atrue', 'reach_fetch_enabled%22%3Afalse');
        url = url.replace('withQuickPromoteEligibilityTweetFields%22%3Atrue', 'withQuickPromoteEligibilityTweetFields%22%3Afalse');
        url = url.replace('article_tweet_consumption_enabled%22%3Atrue', 'article_tweet_consumption_enabled%22%3Afalse');
        url = url.replace('count%22%3A20', 'count%22%3A30');

        thisRef.addEventListener('readystatechange', function (e)
        {
            if (thisRef.readyState === 4)
            {
                let json = null;

                try {
                    json = JSON.parse(e.target.response);
                } catch(e) {
                    return;
                }

                if(json?.data != null)
                {
                    processTimelineData(json);
                    Object.defineProperty(thisRef, 'response', { writable: true });
                    Object.defineProperty(thisRef, 'responseText', { writable: true });

                   thisRef.response = thisRef.responseText = JSON.stringify(json);
                }
            }
        });
    }
    else if(url.includes('/videoads/'))
    {
         thisRef.addEventListener('readystatechange', function (e)
        {
            if (thisRef.readyState === 4)
            {
                    Object.defineProperty(thisRef, 'responseText', { writable: true });
                    thisRef.responseText = "{}";
            }
        });
    }
    /*   else if(url.includes('guide.json')) //Explore
        {
             this.addEventListener('readystatechange', function (e)
            {
                 if (this.readyState === 4)
                {
                     let json = JSON.parse(e.target.response);
                    processExploreData(json?.globalObjects?.tweets);

                    Object.defineProperty(this, 'responseText', { writable: true });
                    this.responseText = JSON.stringify(json);
                }

             });
        }*/
}

function stripVariants(variants, keepM3U = false)
{
    if(variants == null) { return null; }
    let bestQuality = variants.reduce((a, b) => ((a?.bitrate ?? 0) > (b?.bitrate ?? 0) ? a : b));
    if(keepM3U)
    {
        let m3u = variants.find((entry) => entry.url.includes('.m3u8'));
        if(m3u === undefined) { return [bestQuality]; }
        return [bestQuality, m3u];
    }

    return bestQuality;
}

function processMediaResponseData(mediasJson)
{
    let hqVideo = toggleHQVideo.enabled;
    let hqImg = toggleHQImg.enabled;

    mediasJson.forEach((mediaItem) =>
    {
        if(hqVideo === true && mediaItem.type === 'video')
        {
            mediaItem.video_info.variants = stripVariants(mediaItem.video_info.variants, true);
        }
        else if(hqImg === true && mediaItem.type == 'photo')
        {
            mediaItem.media_url_https = getHighQualityImage(mediaItem.media_url_https);
        }
    });
}

class Tweet
{
    constructor(tweetResult)
    {
        let data = tweetResult;
        if(data?.tweet != null){ data = data.tweet; } //If tweet is limited by who can comment, need to do this

        this.isRetweet = data?.legacy?.retweeted_status_result?.result != null;
        if(this.isRetweet)
        {
            data = data.legacy.retweeted_status_result.result;
            if(data?.tweet) { data = data.tweet; }

        }

        this.id = data?.rest_id ?? data?.conversation_id;
        tweets.set(this.id, this);

        let legacy = data?.legacy ?? data; //Swapping to handle odd Explore page data

        this.media = legacy?.extended_entities?.media;
        this.hasMedia = this.media != null;

        this.quote = data?.quoted_status_result?.result;
        this.isQuote = this.quote != null;
        if(this.isQuote) { this.quote = new Tweet(this.quote); }
        this.quoteHasMedia = this.isQuote && this.quote.hasMedia;

        this.username = data?.core?.user_results?.result.legacy?.screen_name;
        this.url = "https://twitter.com/" + this.username + "/" + this.id;

        if(this.hasMedia === true)
        {
            if(this.media != null) { processMediaResponseData(this.media);}
            if(this.isQuote === true && this.quoteHasMedia === true) { processMediaResponseData(this.quote.media); }
        }
        else if(data?.card?.legacy != null)
        {
            let cardLegacy = data.card.legacy;
            if(cardLegacy.binding_values != null)
            {
                for(let i = 0; i < cardLegacy.binding_values.length; i++)
                {
                    let bv = cardLegacy.binding_values[i];
                    if(bv.key === "unified_card")
                    {
                        let cardValue = bv.value;
                        if(cardValue?.type != "STRING") { break; }

                        let valueJson = JSON.parse(cardValue.string_value);

                        valueJson.type = "video"; //Preventing clicking on video opening up a new tab, blocks recent exploits and overall better UX
                        if(valueJson.components.length > 0)
                        {
                            this.media = [];
                            let hqVideo = toggleHQVideo.enabled;
                            valueJson.components.forEach((comp) => {
                                if(comp.startsWith("media_"))
                                {
                                    let compData = valueJson.component_objects[comp].data;
                                    let mediaId = compData.id;
                                    let destination = valueJson.destination_objects[compData.destination].data.url_data;
                                    destination.vanity = destination.url.substr(0, 40);
                                    let mediaData = valueJson.media_entities[mediaId];
                                    if(hqVideo === true && mediaData.video_info != null)
                                    {
                                        mediaData.video_info.variants = stripVariants(mediaData.video_info.variants, true);
                                    }
                                    this.media.push(mediaData);
                                }
                                if(comp.startsWith("details_"))
                                {
                                    let compData = valueJson.component_objects[comp].data;

                                    let destination = valueJson.destination_objects[compData.destination].data.url_data;
                                    destination.vanity = destination.url.substr(0, 90);
                                }
                            });

                            this.hasMedia = this.media.length > 0;
                            cardValue.string_value = JSON.stringify(valueJson);
                        }
                    }
                    else if(bv.key === "photo_image_full_size_original")
                    {
                        let card_img = bv.value?.image_value;

                        if(card_img)
                        {

                            let card_img_id = card_img.url.split('?')[0].split('/').at(-1);
                            this.media = [{type: "photo", media_url_https: card_img.url, id_str: card_img_id, expanded_url: this.url, original_info: {width: card_img.width, height: card_img.height}}];
                            this.hasMedia = true;
                            break;
                        }
                    }
                }
            }
        }


        if(data?.edit_control?.edit_tweet_ids != null)
        {
            data?.edit_control?.edit_tweet_ids.forEach((edit_id) => { tweets.set(edit_id, this); });
        }

        this.isBookmarked = legacy?.bookmarked ?? false;
    }

    get bookmarked() { return this.isBookmarked; };
    bookmark() { this.isBookmarked = true; }
    unbookmark() { this.isBookmarked = false; }

    getMediaData = function(index)
    {
        if(this.media == null || this.media.length <= index) { return null; }

        let mediaItem = this.media[index];

        let username = this.username;
        let id = this.id;
        let media_id = mediaItem.id_str;
        let media_url = mediaItem.media_url_https;
        let url = mediaItem.expanded_url;
        if(!url.includes('card_img/'))
        {
            let comIndex = url.indexOf('.com/');
            let urlParts = url.substring(comIndex < 0 ? 0 : comIndex + 5).split('/');
            if(urlParts.length > 3)
            {
                username = urlParts[0];
                id = urlParts[2];
            }
        }
        let isVideo = mediaItem.type == 'video' || media_url.includes('/tweet_video_thumb/');
        let isPhoto = mediaItem.type == 'photo';
        let counter = this.media.length < 2 ? -1 : index + 1;

        return {
            username: username,
            id: id,
            media_id: media_id,
            media_url: media_url,
            mediaNum: counter,
            isVideo: isVideo,
            isPhoto: isPhoto,
            getContentURL: () => {
                if(isVideo) {
                    return stripVariants(mediaItem.video_info.variants).url; }
                return getHighQualityImage(media_url);
            },
            type: mediaItem.type,
            width: mediaItem.original_info.width,
            height: mediaItem.original_info.height
        };
    }
}

function processExploreData(exploreTweets)
{
    for(let i = 0; i < exploreTweets.length; i++)
    {
        let exploreTweet = exploreTweets[i];
        let tweet = new Tweet(exploreTweet);
    }
}

function processTimelineItem(item)
{
    if(item?.promotedMetadata != null) { return false; }
    let result = item?.tweet_results?.result;

    if(result)
    {
        let tweet = new Tweet(result);
    }

    return true;
}

function processTimelineEntry(entry)
{
    if(entry?.content?.clientEventInfo?.component == "suggest_promoted")
    {
        entry.content = {};
        return;
    }
    let items = entry?.content?.items;
    if(items != null)
    {
        for(let i = 0; i < items.length; i++)
        {
            if(!processTimelineItem(items[i].item.itemContent))
            {
                entry.content.items.splice(i, 1);
            }
        }
    }
    else if (entry?.content?.itemContent)
    {
        if(!processTimelineItem(entry.content.itemContent))
        {
            entry.content = {};
        }
    }
    else if (entry?.item?.itemContent)
    {
        if(!processTimelineItem(entry.item.itemContent))
        {
            entry.item = {};
        }
    }
}

function processTimelineEntries(entries)
{
  //  entries.filter(entry => entry.content.clientEventInfo?.component != "suggest_promoted");
    for(let i = 0; i < entries.length; i++)
    {
        processTimelineEntry(entries[i]);
    }
}
function processTimelineModuleEntries(moduleEntries)
{
        for(let i = 0; i < moduleEntries.length; i++)
    {
        processTimelineEntry(moduleEntries[i]);
    }
}

function processTimelineData(json)
{
    let instructions = json?.data?.home?.home_timeline_urt?.instructions;
    if(instructions == null) { instructions = json.data?.user?.result?.timeline_v2?.timeline?.instructions; }
    if(instructions == null) { instructions = json.data?.user?.result?.timeline?.timeline?.instructions; }
    if(instructions == null) { instructions = json.data?.threaded_conversation_with_injections_v2?.instructions; }
    if(instructions == null) { instructions = json.data?.bookmark_timeline_v2?.timeline?.instructions; }
    if(instructions == null) { instructions = json.data?.list?.tweets_timeline?.timeline?.instructions; }
    if(instructions == null) { instructions = json.data?.search_by_raw_query?.search_timeline?.timeline?.instructions; }
    if(instructions == null) { instructions = json.data?.communityResults?.result?.ranked_community_timeline?.timeline?.instructions; }
    if(instructions == null) { return; }

    for(let inst = 0; inst < instructions.length; inst++)
    {
        let instruction = instructions[inst];
        if(instruction.type == "TimelineAddEntries")
        {
            processTimelineEntries(instruction.entries);
        }
        else if(instruction.type == "TimelinePinEntry")
        {
            processTimelineEntry(instruction.entry); //Pinned tweet
        }
        else if(instruction.type == "TimelineAddToModule")
        {
            processTimelineModuleEntries(instruction.moduleItems); //Pinned tweet
        }
    }
}

var firstRun = true;

function processTweetsQuery(entries)
{
    for(let i = entries.length - 1; i >= 0; i--)
    {
        let entry = entries[i];
        let content = entry.content;
        if(content == null) { continue; }

        if(content.items)
        {
            content = content.items[0].item.itemContent;
        }
        else
        {
            content = content.itemContent;
        }

        if(content == null || content.tweet_results == null) { continue; }
        if(firstRun && entries.length <= 4) //Avoid the timeline freezing from not enough initial entries
        {
            continue;
        }

        if(content.promotedMetadata && content.promotedMetadata.advertiser_results)
        {
            entries.splice(i, 1);
        }
        else if(content.socialContext)
        {

            let contextType = content.socialContext.contextType;

            if((!toggleLiked.enabled && contextType == "Like") || (!toggleFollowed.enabled && contextType == "Follow") || (!toggleTopics.enabled && content.socialContext.type == "TimelineTopicContext"))
            {
                entries.splice(i, 1);
            }

        }
        else if(!toggleRetweet.enabled
                && content.tweet_results.result.legacy != null
                && content.tweet_results.result.legacy.retweeted_status_result != null
               && content.tweet_results.result.legacy.retweeted_status_result.result.core.user_results.result.legacy.following == false) //Only hide the Retweet if it's not the user's own tweet
        {

             entries.splice(i, 1);
        }
    }

    firstRun = false;
    return entries;
}


function getPostButtonCopy(tweet, name, svg, svgViewBox, color, bgColor, onHovering, onNotHovering)
{
    let getButtonToDupe = function (btnGrp)
    {
        let lastChd = btnGrp.lastChild;
        //let bm = btnGrp.querySelector('div > div[data-testid="bookmark"], div > div[data-testid="removeBookmark"]');
        //if(bm != null) { lastChd = bm.parentElement; }
        let newNode = lastChd.cloneNode(true);
        lastChd.className = btnGrp.childNodes.item(2).className;
        return {btn: newNode, origBtn: lastChd}
    };

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
                let orig = btnGrp.querySelector('a:nth-child(2)');
                return { btn: orig.cloneNode(true), origBtn: orig };
            };
        }
    }
    if (buttonGrp == null || buttonGrp.querySelector("div#" + id) != null) { return null; } //Button group doesn't exist or we already processed this element and added a DL button

    buttonGrp.style.maxWidth = "100%";

    /*if(!toggleAnalyticsDisplay.enabled)
    {
        let analBtn = buttonGrp.querySelector('a[href$="/analytics"]');
        if(analBtn) { analBtn.parentElement.style.display = "none"; }
    }*/

    let btnDupe = getButtonToDupe(buttonGrp);

    if(btnDupe.btn != null)
    {
        let btn = btnDupe.btn;
        buttonGrp.insertBefore(btn, btnDupe.origBtn);
       // let shareBtn = btnDupe.origBtn.querySelector('[aria-label^="Share"]');
       // if(shareBtn)
       // {
      //      buttonGrp.appendChild(btnDupe.origBtn);
            btnDupe.origBtn.style += " -webkit-flex-grow: 0.1; flex-grow: 0.1 !important;";
      //  }

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

        let hover = function()
        {
            $(bg).css("background-color", bgColor);
            $(bg).css("border-radius", "20px");
            $(svgElem).css("color", color);
          //  onHovering({btn: btn, inIframe: isIframe, svg: svgElem});
        };

        let unhover = function()
        {
            $(bg).css("background-color", oldBGColor);
            $(svgElem).css("color", oldIconColor);
            if(onNotHovering) onNotHovering(svgElem);
        };

        let updateColor = function()
        {
          if(btn.matches(":hover")) { unhover(); }
          else { hover(); }
        };

        //Emulate Twitter hover color change
        $(btn).hover(() => { hover(); }, () => { unhover(); });

        $(bg).css("background-color", oldBGColor);
        $(svgElem).css("color", oldIconColor);


        return {btn: btn, origBtn: btnDupe.origBtn, inIframe: isIframe, svg: svgElem, doHover: hover, doUnhover: unhover, updateCol: updateColor};
    }

    return null;
}

function addBookmarkButton(tweetElem, tweetData)
{
    return;
	if(tweetElem == null) { return; }

    let id = tweetData.id;
    let existingBookmark = tweetElem.querySelector('div[data-testid="bookmark"]');

    if(existingBookmark != null)
    {
        return;
        existingBookmark = existingBookmark.parentElement;
        existingBookmark.style += " -webkit-flex: 0.6 1.0; flex: 0.6 1.0;";;
        let otherBtn = existingBookmark.closest('[role="group"]').childNodes.item(2);
        $(existingBookmark).removeClass().addClass(otherBtn.className);
        return;
    }

    let onHoverStopped = function(svgElem, tweetID)
    {
         let tweetData = tweets.get(tweetID);
        if(tweetData && tweetData.bookmarked) {
            $(svgElem).css("color", "#1c9bf0FF");
        }
    }

    const btnCopy = getPostButtonCopy(tweetElem, "Bookmark", bookmarkSVG, "0 0 24 24", "#1c9bf0", "#1c9bf01a", (data)=>{}, (svgElem) => {onHoverStopped(svgElem, id);});

    if(btnCopy == null || btnCopy.btn == null) { return; }
    let btn = btnCopy.btn;

    onHoverStopped(btnCopy.svg, id);

    $(btn).click(function (e)
    {
        e.preventDefault();
        e.stopPropagation();
        let tweetData = tweets.get(id);

        if(tweetData == null) { return;}
        if(tweetData.bookmarked)
        {
            unbookmarkPost(id, (resp) =>
            {
                if(resp.status < 300)
                {
                    tweetData.unbookmark();
                    btnCopy.updateCol();
                }
            });
        }
        else
        {
           bookmarkPost(id, (resp) =>
           {
                if(resp.status < 300)
                {
                    tweetData.bookmark();
                    btnCopy.updateCol();
                }
            });
        }
    });

    btnCopy.btn.style += " -webkit-flex: 0.6 1.0; flex: 0.6 1.0;";;
}

async function addDownloadButton(tweetElem, tweetData, mediaInfo)
{
    for(let i = mediaInfo.data.mediaNum - 1; i > 0; i--)
    {
        if(tweetData.media[i].isVideo) { return; }
    }

    const btnCopy = getPostButtonCopy(tweetElem, "Download", dlSVG, "-80 -80 160 160", "#f3d607FF", "#f3d60720");
    if(btnCopy == null) { return; }

    const dlBtn = btnCopy.btn;

    if(dlBtn == null || btnCopy == null) { return; }

    let isIframe = btnCopy.inIframe;
    const filename = filenameFromMediaData(mediaInfo.data);

    const linkElem = dlBtn

    if (isIframe)
    {
        let classy = dlBtn.className;
        dlBtn.className = "";
        linkElem = $(dlBtn).wrapAll(`<a href="${mediaInfo.data.getContentURL()}" download="${filename}" style=""></a>`)[0].parentElement;
        linkElem.setAttribute('download', filename);
        dlBtn.querySelector('div[dir="auto"] > span').innerText = "Download";
        btnCopy.btn = $(linkElem).wrapAll(`<div class="${classy}"></a>`)[0].parentElement;
    }
    else
    {
        dlBtn.style.marginLeft = "";
        linkElem.style.cssText = dlBtn.style.cssText;
        dlBtn.style.marginRight = "";
    }


    $(linkElem).click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        let dlurl = mediaInfo.data.getContentURL();
        download(dlurl, filename);
    });

    btnCopy.btn.className = btnCopy.origBtn.className;
    btnCopy.btn.style += " -webkit-flex: 0.6 1.0; flex: 0.6 1.0; justify-content: center !important;";;
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
    if (imgElem.src != src && toggleHQImg.enabled)
    {
        imgElem.src = src;
        bgElem.style.backgroundImage = `url("${src}")`;
    }
};

function updateElemPadding(panelCnt, background, imgContainerElem)
{
    if (panelCnt != 3)
    {
        if(background)
        {
        background.style.backgroundSize = "cover";
        } else {}
        //imgContainerElem.style.marginBottom = "0%";
    }
    if (panelCnt < 2)
    {
       // imgContainerElem.removeAttribute('style');
    }
    else
    {
        imgContainerElem.style.marginLeft = "0%";
        imgContainerElem.style.marginRight = "0%";
        imgContainerElem.style.marginTop = "0%";
    }
};

function updateContentElement(tweetElem, tweetData, mediaInfo, elemIndex, elemCnt)
{
    let mediaElem = mediaInfo.mediaElem;
    let tweetPhoto = mediaElem.closest('div[data-testid="tweetPhoto"],div[data-testid^="card.wrapper"]');
    const flexDir = $(tweetPhoto).css('flex-direction');
    const isVideo = mediaInfo.data.isVideo;
    let bg = isVideo ? mediaElem.parentElement : tweetPhoto.querySelector('div[style^="background-image"]');

    let linkElem = tweetPhoto.querySelector('div[data-testid="videoPlayer"]') ?? mediaElem?.closest('a');

    mediaInfo.tweetPhotoElem = tweetPhoto;
    mediaInfo.linkElem = linkElem;
    mediaInfo.bgElem = bg;
    mediaInfo.flex = flexDir;

    if(isVideo)
    {
        addDownloadButton(tweetElem, tweetData, mediaInfo);
        //Consistent video controls for GIF videos too
        if(mediaInfo.data.media_url.includes('/tweet_video_thumb'))
        {
            mediaElem.removeAttribute('controls');
            mediaElem.onplaying = (e) => { if(!mediaElem.paused && !mediaElem.getAttribute("isHovering")) { mediaElem.removeAttribute('controls'); } };
            mediaElem.onmouseover = (e) => { mediaElem.controls = true; mediaElem.setAttribute("isHovering", true); };
            mediaElem.onmouseout = (e) => { if(!mediaElem.paused ) { mediaElem.removeAttribute('controls'); mediaElem.removeAttribute("isHovering"); } };

            let vidComp = mediaElem.closest('div[data-testid="videoComponent"]');
            if(vidComp)
            {
                if(vidComp.childElementCount > 1)
                {
                    let tab = vidComp.lastElementChild;
                    if(tab)
                    {
                        tab.remove();
                    }
                }
            }
        }
    }
    else if(toggleHQImg.enabled === true)
    {
        let hqImg = mediaInfo.data.getContentURL();
        updateImgSrc(mediaElem, bg, hqImg);
    }

    addCustomCtxMenu(tweetData, mediaInfo, mediaInfo.linkElem);
//    mediaElem.setAttribute(modifiedAttr, "");

    updateElemPadding(elemCnt, bg, tweetPhoto);
    doOnAttributeChange(tweetPhoto, (container) => updateElemPadding(elemCnt, bg, container), true);
}

function updateContentElements(tweetElem, tweetData, mediaInfos)
{
    if(tweetData == null || mediaInfos == null) { return; }

    let elemCnt = mediaInfos.length;
    for(let i = 0; i < elemCnt; i++)
    {
        updateContentElement(tweetElem, tweetData, mediaInfos[i], i, elemCnt);
    }

    updateContentLayout(tweetElem, tweetData, mediaInfos);
}

async function updatePadder(tweetElem, ratio)
{
    let padder = await awaitElem(tweetElem, 'div[id^="id_"] [thd_customctx]');
    if(padder == null) { return; }

    padder = padder.closest('div[id^="id_"]').querySelector('div[style^="padding-bottom"]');

    const modPaddingAttr = "modifiedPadding";

    if(padder != null && !addHasAttribute(padder, modPaddingAttr))
    {
        const padderParent = padder.parentElement;
        const flexer = padder.closest('div[id^="id_"] > div');
        const bg = flexer.querySelector('div[style^="background"] > div');

        padder.style = `padding-bottom: ${ratio}%;`;
        flexer.style = "align-self:normal; !important"; //Counteract Twitter's new variable width display of content that is rather wasteful of screenspace
        if(bg) { bg.style.width = "100%"; }

        padderParent.removeAttribute('style');

        doOnAttributeChange(padder, (padderElem) => { if(padderElem.getAttribute("modifiedPadding") == null) { padderElem.style = "padding-bottom: " + (ratio) + "%;";} })
        if(!addHasAttribute(padderParent, modPaddingAttr))
        {
            doOnAttributeChange(padderParent, (padderParentElem) => { if(padderParentElem.getAttribute("modifiedPadding") == null) { padderParentElem.removeAttribute('style');} })
        }
    }
}

function updateContentLayout(tweetElem, tweetData, mediaElems)
{
     processBlurButton(tweetElem);

    let elemCnt = mediaElems.length;

    let ratio = (mediaElems[0].data.height / mediaElems[0].data.width);

    if(elemCnt < 2 && mediaElems[0].data.isVideo)
    {
        let innerHeight = window.innerHeight;
        let curRatio = (innerHeight / curLayoutWidth) * 0.8;
        if(curRatio < ratio) ratio = curRatio;
    }
    ratio *= 100;
    if (elemCnt == 2)
    {
        let img1 = mediaElems[0];
        let img2 = mediaElems[1];
        let img1Ratio = img1.data.height / img1.data.width;
        let img2Ratio = img2.data.height / img2.data.width;
        let imgToRatio = img1Ratio > img2Ratio ? img1 : img2;
        ratio = (imgToRatio.data.height / imgToRatio.data.width);

        img1.bgElem.style.backgroundSize = "cover";
        img2.bgElem.style.backgroundSize = "cover";
        img1.tweetPhotoElem.parentElement.removeAttribute("style");
        img2.tweetPhotoElem.parentElement.removeAttribute("style");

        if (img1.flex == "row")
        {
            if (imgToRatio.data.height > imgToRatio.data.width)
            {
                ratio *= 0.5;
            }
        }
        else
        {
            //if(ratio > 1.0) {   ratio = ((ratio - 1.0) * 0.5) + 1.0;}
            ratio *= 0.5;
        }

        if (imgToRatio.data.isVideo && imgToRatio.data.width > imgToRatio.data.height)
        {
            ratio = (img1.data.height + img2.data.height) / img1.data.width;
            const padderly = tweetElem.querySelector('div[id^="id_"] div[style^="padding-bottom"]');
            padderly.parentElement.lastElementChild.firstElementChild.style.flexDirection = "column";
        }

        ratio = Math.min(ratio, 3.0);
        ratio = ratio * 100;
    }
    else if (elemCnt == 3 && mediaElems[0].flex == "row")
    {
        let img1 = mediaElems[0];
        let img1Ratio = img1.data.height / img1.data.width;
        if (img1Ratio < 1.10 && img1Ratio > 0.9) { img1.bgElem.style.backgroundSize = "contain"; }
    }
    else if (elemCnt == 4)
    {
        if (mediaElems[0].data.width > mediaElems[0].data.height &&
            mediaElems[1].data.width > mediaElems[1].data.height &&
            mediaElems[2].data.width > mediaElems[2].data.height &&
            mediaElems[3].data.width > mediaElems[3].data.height)
        {} //All-wide 4-panel already has an optimal layout by default.
        else if (mediaElems[0].data.width > mediaElems[0].data.height)
        {
            // ratio = 100;
            let img1Ratio = mediaElems[0].data.height / mediaElems[0].data.width;
            let img2Ratio = mediaElems[1].data.height / mediaElems[1].data.width;
            let img3Ratio = mediaElems[2].data.height / mediaElems[2].data.width;
            let img4Ratio = mediaElems[3].data.height / mediaElems[3].data.width;
            let minImg = img1Ratio > img2Ratio ? mediaElems[1] : mediaElems[0];

            ratio = (mediaElems[0].data.height + mediaElems[1].data.height) / minImg.data.width;
            ratio *= 100;
        }
    }


    updatePadder(tweetElem, ratio);
    watchForChange(tweetElem, argsChildAndSub, (tweet, mutes) => { updatePadder(tweetElem, ratio); });


 /*   for (let i = 0; i < elemCnt; i++)
    {
        let curImg = mediaElems[i];
        updateImgSrc(curImg, curImg.bgElem, curImg.hqSrc);
        doOnAttributeChange(curImg.layoutContainer, () => { updateImgSrc(curImg, curImg.bgElem, curImg.hqSrc) });
    }*/

    //Annoying Edge....edge-case. Have to find this random class name generated element and remove its align so that elements will expand fully into the feed column
    let edgeCase = getCSSRuleContainingStyle('align-self', ['.r-'], 0, 'flex-start');
    if (edgeCase != null)
    {
        edgeCase.style.setProperty('align-self', "inherit");
    }

//    if(padder != null)
//    {
 //       doOnAttributeChange(padder, (padderElem) => { if(padderElem.getAttribute("modifiedPadding") == null) { padderElem.style = "padding-bottom: " + (ratio) + "%;";} })
 //       doOnAttributeChange(padder.parentElement, (padderParentElem) => { if(padderParentElem.getAttribute("modifiedPadding") == null) { padderParentElem.style = "";} })
 //   }
}


function isAdvert(tweet)
{
    let impression = tweet.querySelector('div[data-testid="placementTracking"] div[data-testid$="impression-pixel"]');
    if(impression)
    {
        tweet.style.display = "none";
        return true;
    }
    return false;
}

const mediaInfoBuffer = [8];
const elemsQueryBuffer = [8];

async function processTweetContent(tweet, tweetData)
{
    let medias = tweetData.media;
    let elemsQuery = new Array(medias.length);
    let mediaInfos = new Array(medias.length);

    for(let i = 0; i < medias.length; i++)
    {
        let mediaData = tweetData.getMediaData(i);

        mediaInfos[i] = { data: mediaData, mediaElem: null, linkElem: null, tweetPhotoElem: null, bgElem: null, flex: null };

        if(mediaData.isPhoto === true)
        {
            let srcID = mediaData.media_url.substring(mediaData.media_url.lastIndexOf('/') + 1).split('?')[0].split('.')[0];
            elemsQuery[i] = awaitElem(tweet, `[src*="${srcID}"]`, argsChildAndSub);
        }
        else
        {
            elemsQuery[i] = awaitElem(tweet, `video[poster^="${mediaData.media_url.split('?')[0]}"]`, argsChildAndSub);
        }

    }

    Promise.allSettled(elemsQuery).then((values) =>
    {
        for(let i = 0; i < values.length; i++)
        {
            mediaInfos[i].mediaElem = values[i].value;
        }
        updateContentElements(tweet, tweetData, mediaInfos);
    });
}

function processTweet(tweet, tweetObserver)
{
    tweetObserver.disconnect();
    if (tweet == null /*|| (!isOStatusPage() && tweet.querySelector('div[data-testid="placementTracking"]') == null)*/ ) { return false; } //If video, should have placementTracking after first mutation
    if (tweet.getAttribute(modifiedAttr) != null || tweet.querySelector(`[${modifiedAttr}]`) ) { return true; }

    addHasAttribute(tweet, modifiedAttr);

    if(toggleMakeLinksVX.enabled)
    {
        awaitElem(tweet, 'a:has(> time)', { childList: true, subtree: true, attributes: false}).then((linky) => {
            linky.href = replaceWithVX(linky.href);
        });
    }
    if(isAdvert(tweet)) { return; }

    let tweetData = getTweetData(tweet);
    if(tweetData == null) {  return; }


    if(tweetData.hasMedia) { processTweetContent(tweet, tweetData); }
    if(tweetData.isQuote && tweetData.quote.hasMedia) {
        tweetData.quote.tweetElem = tweet;
        processTweetContent(tweet, tweetData.quote);
    }
}

async function listenForMediaType(tweet)
{
    if (addHasAttribute(tweet, "thd_observing")) { return; }

  //  if(!setupFilters(tweet)) { return; }
    const tweetObserver = new MutationObserver((muteList, observer) => {

        processTweet(tweet, observer);
        tweetObserver.observe(tweet, { attributes: true, childList: true, subtree: true });
    });

    processTweet(tweet, tweetObserver);
    tweetObserver.observe(tweet, { attributes: true, childList: true, subtree: true });
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

//<--> COLUMN RESIZING START<-->//
var primaryColumnCursorDistToEdge = 900;
var primaryColumnMouseDownPos = 0;
var primaryColumnResizing = false;
var primaryColumnPreWidth = 600;
var maxWidthClass = null;
var preCursor;
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

var curLayoutWidth = 600;

function updateLayoutWidth(width, finalize)
{
    curLayoutWidth = width;
    if(!toggleTimelineScaling.enabled) { return; }

    maxWidthClass.style.setProperty('max-width', width + "px");
    if (finalize)
    {
        headerColumn = document.body.querySelector('HEADER');
        headerColumn.style.flexGrow = 0.2;
        headerColumn.style.webkitBoxFlex = 0.2;
        setUserPref(usePref_MainWidthKey, width);
    }
}


function refreshLayoutWidth()
{
    let width = getUserPref(usePref_MainWidthKey, 600);
    updateLayoutWidth(width, true);
}
//<--> COLUMN RESIZING END <-->//

//<--> TIMELINE PROCESSING <-->//
async function onTimelineContainerChange(container, mutations)
{
     replaceMuskratText(container);
    LogMessage("on timeline container change");
    let tl = await awaitElem(container, 'DIV[style*="position:"]', { childList: true, subtree: true, attributes: true });
    observeTimeline(tl);
}

function onTimelineChange(addedNodes)
{
 // replaceMuskratText(document.body);
    if (addedNodes.length == 0) { LogMessage("no added nodes"); return; }
    addedNodes.forEach((child) =>
    {
        //   if(addHasAttribute(child, modifiedAttr)) { return; }
        awaitElem(child, 'ARTICLE', argsChildAndSub).then(listenForMediaType);
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

async function watchForTimeline(primaryColumn)
{
    let section = await awaitElem(primaryColumn, 'section[role="region"]', argsChildAndSub);

    if (addHasAttribute(section, modifiedAttr)) { return; }

    if(!addHasAttribute(section.parentElement, modifiedAttr)) {
        watchForAddedNodes(section.parentElement, false,{ attributes: false, childList: true, subtree: false }, (addedNodes, mutes) => {
            watchForTimeline(primaryColumn);

        });
    }

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

    let progBarObserver = new MutationObserver((mutations) => {
        progBarObserver.disconnect();
        checkTimeline();
        progBarObserver.observe(section, { attributes: false, childList: true });
    });
    progBarObserver.observe(section, { attributes: false, childList: true });
}

var pageWidthLayoutRule;


async function watchPrimaryColumn(main, primaryColumn)
{
    if(primaryColumn == null) { return; }
    //

    awaitElem(primaryColumn, 'nav', argsChildAndSub).then((nav) =>
    {
        let navCont = nav.parentElement;
        if (addHasAttribute(navCont, modifiedAttr)) { return; }
        watchForChange(navCont, argsChildOnly, () => { watchForTimeline(primaryColumn, navCont); });
    });

    if (!addHasAttribute(primaryColumn.firstElementChild, modifiedAttr)) {
        //Watch to handle case where timelines are partially lost when clicking on the quoted post name.
        watchForChange(primaryColumn.firstElementChild, argsChildOnly, () => {
            watchForTimeline(primaryColumn);
        });
    }

    if (addHasAttribute(primaryColumn, modifiedAttr)) { return; }
    hideForYou(primaryColumn);

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

    watchForTimeline(primaryColumn);
}

async function onMainChange(main, mutations)
{

    replaceMuskratText(document.body);
    awaitElem(main, 'div[data-testid="primaryColumn"]', argsChildAndSub).then((primaryColumn) =>{
        watchPrimaryColumn(main, primaryColumn);
        replaceMuskratText(document.body);
    });

    watchSideBar(main);
}


function replaceMuskratText(root)
{
    let labels = root.querySelectorAll('span, span > span');

    for(let i = 0; i < labels.length; i++)
    {
        let label = labels[i];
        if(label.innerText == "Post")
        {
            label.innerText = "Tweet";
        }
        else if(label.innerText == "Posts") { label.innerText == "Tweets"; }
    }
}


function hideForYou(primaryColumn)
{
    if(!toggleDisableForYou.enabled) { return; }

    let mainTabs = primaryColumn.querySelector('div[role="tablist"]');
    if(mainTabs)
    {
        let tabs = mainTabs.querySelectorAll('div[role="presentation"] > a[href="/home"]');
        if(tabs.length > 1)
        {
            tabs[0].parentElement.style.display = 'none';
            tabs[1].parentElement.click();
        }
    }
}

//<--> RIGHT SIDEBAR CONTENT <-->//

//<--> Save/Load User Cutom Prefs <-->//
const usePref_MainWidthKey = "thd_primaryWidth";
const usePref_hideTrendingKey = "thd_hideTrending";
const usePref_lastTopicsClearTime = "thd_lastTopicsClearTime";

var toggleNSFW;
var toggleHQImg;
var toggleHQVideo;
var toggleLiked;
var toggleFollowed;
var toggleRetweet;
var toggleTopics;
var toggleClearTopics;
var toggleTimelineScaling;
var toggleAnalyticsDisplay;
var toggleDisableForYou;
var toggleMakeLinksVX;

var prefsLoaded = false;

async function watchSideBar(main)
{
    awaitElem(main, 'div[data-testid="sidebarColumn"]', argsChildAndSub).then((sideBar) =>
    {
        awaitElem(sideBar, 'section[role="region"] > [role="heading"]', argsChildAndSub).then((sideBarTrending) =>
        {
            setupTrendingControls(sideBarTrending.parentElement);
            setupToggles(sideBar);
            clearTopicsAndInterests();
        });
    });
}

async function getToggleObj(name, defaultVal)
{
    let enable = await getUserPref(name, defaultVal);
    return {enabled: enable, elem: null, name: name, onChanged: new EventTarget(), listen: function(func) { this.onChanged.addEventListener(this.name, func); }};
}

const nsfwBlurBtnSelector = 'div[role="button"][style*="backdrop-filter: blur(4px);"][style*="background-color:"]';
const nsfwBlurBtnSubSelector = 'div[dir="ltr"] > span > span';

const nsfwBlurBtnElemQuery = `${nsfwBlurBtnSelector}:has(> ${nsfwBlurBtnSubSelector})`;
const nsfwBlurBtnElemSelector = `${nsfwBlurBtnSelector} > ${nsfwBlurBtnSubSelector}`;

const nsfwBlurRootQuery = `div:has(> div > div > ${nsfwBlurBtnElemSelector}):has(div[data-testid="tweetPhoto"])`;
const nsfwBlurUIQuery = `${nsfwBlurRootQuery} > div:has(${nsfwBlurBtnSelector}):has(${nsfwBlurBtnSubSelector})`;
const nsfwBlurBtnQuery = `${nsfwBlurRootQuery} ${nsfwBlurBtnElemQuery}`;
const nsfwBlurFilterQuery = `${nsfwBlurRootQuery} > div:has(div[data-testid="tweetPhoto"])`;

function toggle_nsfwBlurStyle(enabled)
{
    if(!enabled)
    {
        addGlobalStyle(//Media thumb view overlay css target
`div[aria-label^="Timeline:"] div[data-testid="cellInnerDiv"] li[role="listitem"] div:has(> div > svg > g > path) > div:has(img) {
    -webkit-filter: blur(0px) !important;
            filter: blur(0px) !important;
}

div[aria-label^="Timeline:"] div[data-testid="cellInnerDiv"] li[role="listitem"] div:has(> svg > g > path) {
    display: none !important;
}

article[data-testid="tweet"] div[aria-labelledby^="id_"] :not([tabindex]) > div:has(> div > div > div[role="button"][style*="blur"])
{
> div:not(:has(div[data-testid^="tweet"]), :has([style^="transition-d"] > [aria-label])) { display: none !important; }
> div > div > div[role="button"] { display: none !important; }
> div:has(div[data-testid^="tweet"]) { -webkit-filter: none !important; filter: none !important; }
}
article[data-testid="tweet"] div[aria-labelledby^="id_"] [data-testid="videoComponent"] > div[tabindex]:has([style^="transition-d"] > [aria-label])
{
    display: none !important;
}
`, "nsfwblur");

    }
    if(enabled)
    {
        removeGlobalStyle("nsfwblur");
    }
}

async function loadToggleValues()
{
    if(prefsLoaded === true) { return; }

    await Promise.allSettled([
        (async() => { toggleNSFW = await getToggleObj("thd_blurNSFW", false) })(),
        (async() => { toggleHQImg = await getToggleObj("thd_toggleHQImg", true) })(),
        (async() => { toggleHQVideo = await getToggleObj("thd_toggleHQVideo", true) })(),
        (async() => { toggleLiked = await getToggleObj("thd_toggleLiked", true) })(),
        (async() => { toggleFollowed = await getToggleObj("thd_toggleFollowed", false) })(),
        (async() => { toggleRetweet = await getToggleObj("thd_toggleRetweet", false) })(),
        (async() => { toggleTopics = await getToggleObj("thd_toggleTopics", false) })(),
        (async() => { toggleClearTopics = await getToggleObj("thd_toggleClearTopics", false) })(),
        (async() => { toggleTimelineScaling = await getToggleObj("thd_toggleTimelineScaling", true) })(),
        (async() => { toggleAnalyticsDisplay = await getToggleObj("thd_toggleAnalyticsDisplay", false) })(),
        (async() => { toggleDisableForYou = await getToggleObj("thd_toggleDisableForYou", false) })(),
        (async() => { toggleMakeLinksVX = await getToggleObj("thd_makeLinksVX", true) })()
    ]);

    prefsLoaded = true;

    if(!toggleAnalyticsDisplay.enabled)
    {
        addGlobalStyle('div[role="group"] > div:has(> a[href$="/analytics"]) { display: none !important; }', "analyticsStyle");
    }
    toggleAnalyticsDisplay.onChanged.addEventListener(toggleAnalyticsDisplay.name, (e) =>
    {
        if(!toggleAnalyticsDisplay.enabled) { addGlobalStyle('div[role="group"] > div:has(> a[href$="/analytics"]) { display: none !important; }', "analyticsStyle"); }
        else { removeGlobalStyle("analyticsStyle"); }
    });
    toggleNSFW.onChanged.addEventListener(toggleNSFW.name,(e) =>
    {
        toggle_nsfwBlurStyle(toggleNSFW.enabled);
    });
    toggle_nsfwBlurStyle(toggleNSFW.enabled);
}

async function setupToggles(sidePanel)
{
    if(sidePanel.querySelector('.thd_settings_collapsible')){ return; }
    sidePanel = sidePanel.querySelector('div:has(> nav)');

    let settingsFold = document.createElement('button');
    settingsFold.className = 'thd_settings_collapsible';
    settingsFold.innerText = "Twitter AutoHD Settings:";
    let settingsContainer = document.createElement('div');
    settingsContainer.className = 'thd_settings_content thd_settings_content_closed';
    sidePanel.appendChild(settingsFold);
    sidePanel.appendChild(settingsContainer);
    sidePanel = settingsContainer;
    settingsFold.addEventListener("click", function() {
        this.classList.toggle("thd_settings_active");
        var content = this.nextElementSibling;
        content.classList.toggle('thd_settings_content_closed');
    });
    createToggleOption(sidePanel, toggleNSFW, "NSFW Blur: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleHQImg, "HQ Image Loading: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleHQVideo, "HQ Video Loading: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleTimelineScaling, "Timeline Width Scaling: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleMakeLinksVX, "Replace Links with VX Link: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleLiked, "Liked Tweets: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleFollowed, "Followed By Tweets: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleRetweet, "Retweets: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleTopics, "Topic Tweets: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleClearTopics, "Interests/Topics Prefs AutoClear: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleAnalyticsDisplay, "Show Post Views: ", "ON", "OFF");
    createToggleOption(sidePanel, toggleDisableForYou, 'Disable "For You" page: ', "ON", "OFF");
}

function createToggleOption(sidePanel, toggleState, toggleText, toggleOnText, toggleOffText)
{
    toggleState.elem = sidePanel.querySelector('#' + toggleState.name);
    toggleOnText = toggleText + toggleOnText;
    toggleOffText = toggleText + toggleOffText;
    if (toggleState.elem == null)
    {
        toggleState.elem = createToggleButton(toggleState.enabled ? toggleOnText : toggleOffText, toggleState.name);
        toggleState.elem.classList.toggle("thd_settings_toggle_enabled", toggleState.enabled);

        toggleState.elem.addEventListener('click', (e) =>
        {
            toggleState.enabled = toggleState.enabled ? false : true;
            toggleState.elem.classList.toggle("thd_settings_toggle_enabled", toggleState.enabled);
            setUserPref(toggleState.name, toggleState.enabled);
            toggleState.onChanged.dispatchEvent(new CustomEvent(toggleState.name, {'detail':{'toggle':toggleState}}));
            toggleState.elem.innerHTML = toggleState.enabled ? toggleOnText : toggleOffText;
        }, false);

        sidePanel.appendChild(toggleState.elem);
    }
}

var blurShowText = "";

async function processBlurButton(tweet)
{
    const getBlurText = function(blur)
    {
        return blur.querySelector('span > span').innerText;
    }

    const blurBtn = tweet.querySelector(nsfwBlurBtnQuery);
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

            let curBlur = blurParent.querySelector(nsfwBlurBtnQuery);
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
                    curBlur = tweet.querySelector(nsfwBlurBtnQuery);
                    if(curBlur)
                    {
                        curBlur.style.display = toggleNSFW.enabled ? "block" : "none";
                    }
                });
                toggleNSFW.onChanged.addEventListener("nsfwToggleChanged", function(enabled) {
                    curBlur = tweet.querySelector(nsfwBlurBtnQuery);
                    if(curBlur)
                    {
                        curBlur.click();
                        curBlur.style.display = toggleNSFW.enabled ? "block" : "none";
                    }
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
                let isHidden = toggle.innerText == hideStr;
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
    btn.className = 'thd_settings_toggle';
    return btn;
}

async function watchForComments(dialog)
{
    let commentList = await awaitElem(dialog, 'div[style^="position: relative"]', argsChildAndSub);
    observeTimeline(commentList);
}

//<--> FULL-SCREEN IMAGE VIEW RELATED <-->//
async function onLayersChange(layers, mutation)
{

    if (mutation.addedNodes != null && mutation.addedNodes.length > 0)
    {
        const contentContainer = Array.from(mutation.addedNodes)[0];
        if(addHasAttribute(contentContainer, 'thd_modified')) { return; }
        const dialog = await awaitElem(contentContainer, 'div[role="dialog"]', argsChildAndSub);

        watchForComments(dialog);

        let ctxTarget = await awaitElem(dialog, 'img[alt="Image"],div[data-testid="videoPlayer"]', argsChildAndSub);

        const list = dialog.querySelector('ul[role="list"]');
        let id = getIDFromURL(window.location.href);
        let tweetData = tweets.get(id);
        if(tweetData == null) { return; }

        if (list != null /* && !addHasAttribute(list, 'thd_modified')*/ )
        {
            const listItems = list.querySelectorAll('li');
            const itemCnt = listItems.length;

            for (let i = 0; i < itemCnt; i++)
            {
                ctxTarget = await awaitElem(listItems[i], 'img[alt="Image"],div[data-testid="videoPlayer"]', argsChildAndSub);

                let mediaData = tweetData.getMediaData(i);
                if(mediaData)
                {
                    updateFullViewImage(ctxTarget, tweetData, mediaData);
                }
            }
        }
        else
        {
            let mediaData = tweetData.getMediaData(0);
            updateFullViewImage(ctxTarget, tweetData, mediaData);
        }

    }
}

async function updateFullViewImage(ctxTarget, tweetData, mediaData)
{
  //  if (addHasAttribute(img, "thd_modified")) { return; }
    let bg = ctxTarget.parentElement.querySelector('div') ?? ctxTarget.parentElement;

    let mediaInfo = { data: mediaData, linkElem: ctxTarget, mediaElem: ctxTarget };

    addCustomCtxMenu(tweetData, mediaInfo, ctxTarget);
    if(toggleHQImg.enabled === true && !mediaData.isVideo === true)
    {
        let hqSrc = mediaData.getContentURL();
        updateImgSrc(ctxTarget, bg, hqSrc);
        doOnAttributeChange(ctxTarget, (ctxTarg) => { updateImgSrc(ctxTarg, bg, hqSrc); }, false);
    }
}

//<--> RIGHT-CLICK CONTEXT MENU STUFF START <-->//
var ctxMenu;
var ctxMenuList;
var ctxMenuOpenInNewTab;
var ctxMenuOpenVidInNewTab;
var ctxMenuSaveAs;
var ctxMenuSaveAsVid;
var ctxMenuCopyImg;
var ctxMenuCopyAddress;
var ctxMenuCopyVidAddress;
var ctxMenuGRIS;
var ctxMenuShowDefault;

function initializeCtxMenu()
{
    ctxMenu = document.createElement('div');
    ctxMenu.style.zIndex = "500";
    ctxMenu.id = "contextMenu";
    ctxMenu.className = "context-menu";
    ctxMenuList = document.createElement('ul');
    //ctxMenuList.style.zIndex = 500;
    ctxMenu.appendChild(ctxMenuList);

    ctxMenuOpenInNewTab = createCtxMenuItem(ctxMenuList, "Open Image in New Tab");
    ctxMenuOpenVidInNewTab = createCtxMenuItem(ctxMenuList, "Open Video in New Tab");
    ctxMenuSaveAs = createCtxMenuItem(ctxMenuList, "Save Image As");
    ctxMenuSaveAsVid = createCtxMenuItem(ctxMenuList, "Save Video As");
    ctxMenuCopyImg = createCtxMenuItem(ctxMenuList, "Copy Image");
    ctxMenuCopyAddress = createCtxMenuItem(ctxMenuList, "Copy Image Link");
    ctxMenuCopyVidAddress = createCtxMenuItem(ctxMenuList, "Copy Video Link");
    ctxMenuGRIS = createCtxMenuItem(ctxMenuList, "Search Google for Image");
    ctxMenuShowDefault = createCtxMenuItem(ctxMenuList, "Show Default Context Menu");

    document.body.appendChild(ctxMenu);
    document.body.addEventListener('click', function (e) { setContextMenuVisible(false); });

    setContextMenuVisible(false);

    window.addEventListener('locationchange', function () {
        setContextMenuVisible(false);
    });
    window.addEventListener('popstate',() => {
        setContextMenuVisible(false);
    });

}

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

async function updateContextMenuLink(tweetData, mediaInfo)
{
    if(mediaInfo == null) { return; }

    ctxMenu.setAttribute('selection', mediaInfo.data.media_id);

    let isImage = mediaInfo.mediaElem.tagName.toLowerCase() == "img";

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

    const copyAddress = function(url){ setContextMenuVisible(false); navigator.clipboard.writeText(url); };
    const saveMedia = function(url)
    {
        setContextMenuVisible(false);
        download(url, filenameFromMediaData(mediaInfo.data));
    };
    const openInNewTab = function(url)
    {
        setContextMenuVisible(false);
        if (GM_OpenInTabMissing)
        {
            let lastWin = window;
            window.open(url, '_blank');
            lastWin.focus();
        }
        else { GM_openInTab(url, { active: false, insert: true, setParent: true, incognito: false }); }
    };


    //Image Context
    if(isImage == true)
    {
        mediaInfo.mediaElem.crossOrigin = 'Anonymous'; //Needed to avoid browser preventing the Canvas from being copied when doing "Copy Image"

        ctxMenuOpenInNewTab.onclick = () => { openInNewTab(mediaInfo.data.getContentURL()) };
        ctxMenuSaveAs.onclick = () => { saveMedia(mediaInfo.data.getContentURL()) };

        ctxMenuCopyImg.onclick = () =>
        {
            setContextMenuVisible(false);
            try
            {
                let c = document.createElement('canvas');
                c.width = mediaInfo.data.width;
                c.height = mediaInfo.data.height;
                c.getContext('2d').drawImage(mediaInfo.mediaElem, 0, 0, c.width, c.height);
                c.toBlob((png) =>
                         {
                    navigator.clipboard.write([new ClipboardItem({
                        [png.type]: png })]);
                }, "image/png", 1);
            }
            catch (err) { console.log(err); };
        };
        ctxMenuCopyAddress.onclick = (e) => { copyAddress(mediaInfo.data.getContentURL()); };
        ctxMenuGRIS.onclick = () => { setContextMenuVisible(false);
                                     window.open("https://www.google.com/searchbyimage?sbisrc=cr_1_5_2&image_url=" + mediaInfo.data.getContentURL()); };
    }
    else //Video
    {
        ctxMenuOpenVidInNewTab.onclick = () => { openInNewTab(mediaInfo.data.getContentURL()) };
        ctxMenuSaveAsVid.onclick = () => { saveMedia(mediaInfo.data.getContentURL()) };
        ctxMenuCopyVidAddress.onclick = () => { copyAddress(mediaInfo.data.getContentURL()) };
    }

    //Generic Stuff
    ctxMenuShowDefault.onclick = () => { selectedShowDefaultContext = true;
        setContextMenuVisible(false); };
}

function addCustomCtxMenu(tweetData, mediaInfo, ctxTarget)
{
    if (addHasAttribute(ctxTarget, "thd_customctx")) { return; }

    ctxTarget.addEventListener('contextmenu', function (e)
    {
        e.stopPropagation();

        let curSel = ctxMenu.getAttribute('selection');

        if (wasShowDefaultContextClicked())
        { //Skip everything here and show default context menu
            selectedShowDefaultContext = false;
            return;
        }

        e.preventDefault();

        if(ctxMenu.style.display != "block" || (curSel == null || (curSel != null && curSel != mediaInfo.data.media_id)))
        {
            updateContextMenuLink(tweetData, mediaInfo);
            setContextMenuVisible(true);
            ctxMenu.style.left = -12.0 + mouseX(e) + "px";
            ctxMenu.style.top = -10.0 + mouseY(e) + "px";
        }
        else { setContextMenuVisible(false); }

    }, {capture: true}, true);
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
    if (url.includes('pbs.twimg.com/media/'))
    {
        if(!url.includes('name=orig'))
        {
            window.location.href = getHighQualityImage(url);
        }
        return true;
    }
    return false;
}

function download(url, filename)
{
    GM_download(
    {
        name: filename + getMediaFormat(url),
        url: url,
        onload: function () { /*LogMessage(`Downloaded ${url}!`);*/ }
    });
}

function getUrlFromTweet(tweet)
{
    let article = tweet.tagName.toUpperCase() == 'ARTICLE' ? tweet : tweet.querySelector('article');

    if (article == null) { return null; }
    let timeElem = article.querySelector('time');
    if(timeElem)
    {
        let parentLink = timeElem.parentElement;
        if(parentLink.tagName.toUpperCase() == 'A')
        {
            return parentLink.href;
        }
    }

    let postLink = article.querySelector('a:not([href*="/retweets"],[href$="/likes"])[href*="/status/"][role="link"][dir="auto"]');
    let imgLink = article.querySelector('a:not([href*="/retweets"],[href$="/likes"],[dir="auto"])[href*="/status/"][role="link"]');

    if (imgLink)
    {
        let statusLink = imgLink.href.split('/photo/')[0];
        let imgUser = statusLink.split('/status/')[0];
        if (postLink == null || !postLink.href.includes(imgUser)) { return statusLink; }
    }

    if (postLink) { return postLink.href; }


    return null;
}

function getIDFromTweet(tweet)
{
    let url = getUrlFromTweet(tweet);
    return getIDFromURL(url);
}

function getIDFromURL(url)
{
    if(url == null) return null;

    let split = url.split('/');
    for(let i = 0; i < split.length; i++)
    {
        if(split[i] == 'status') { return split[i + 1]; }
    }

    return null;
}

function getTweetData(tweet)
{
     let id = getIDFromTweet(tweet);
    if (id == null) { return null; }

    let tweetData = tweets.get(id);

    if(tweetData == null) { return null; }

    return tweetData;
}

function filenameFromMediaData(mediaData)
{
    let filename = mediaData.username + ' - ' + mediaData.id;
    if (mediaData.mediaNum >= 0) { filename += '_' + mediaData.mediaNum.toString(); }
    return filename;
}

function getHighQualityImage(url)
{
    if(!url.includes("name=")) { return url + (url.includes('?') ? '&' : '?') + 'name=orig'; }
    return url.replace(/(?<=[\&\?]name=)([A-Za-z0-9])+(?=\&)?/, 'orig');
}


//--> PREFERENCE UPDATING <--//
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
            "authorization": authy,
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
                        "authorization": authy,
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
                                    "authorization": authy,
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
            "authorization": authy,
            "content-type": "application/json",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-csrf-token": cooky,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en"
        },
        "referrer": window.location.href, //test if this is fine...  had hardcoded url here before
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
                                "authorization": authy,
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

async function bookmarkPost(postId, onResponse)
{
    fetch("https://api.twitter.com/graphql/aoDbu3RHznuiSkQ9aNM67Q/CreateBookmark", {
        "headers": {
            "accept": "*/*",
            "authorization": authy,
            "content-type": "application/json",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "x-csrf-token": cooky,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en"
        },
        "referrer": window.location.href,
      //  "referrerPolicy": "strict-origin-when-cross-origin",
        "body": `{"variables":{"tweet_id":"${postId}"},"queryId":"aoDbu3RHznuiSkQ9aNM67Q"}`,
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    }).then((resp) => { onResponse(resp); }).catch((err) => {});
}

async function unbookmarkPost(postId, onResponse)
{
    fetch("https://twitter.com/i/api/graphql/Wlmlj2-xzyS1GN3a6cj-mQ/DeleteBookmark", {
        "headers": {
            "accept": "*/*",
            "authorization": authy,
            "content-type": "application/json",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "x-csrf-token": cooky,
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "en"
        },
        "referrer": window.location.href,
      //  "referrerPolicy": "strict-origin-when-cross-origin",
        "body": `{"variables":{"tweet_id":"${postId}"},"queryId":"Wlmlj2-xzyS1GN3a6cj-mQ"}`,
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    }).then((resp) => { onResponse(resp); }).catch((err) => {});
}

//<--> GENERIC UTILITY FUNCTIONS <-->//
function watchForChange(root, obsArguments, onChange)
{
    const rootObserver = new MutationObserver(function (mutations)
    {
        rootObserver?.disconnect();
        mutations.forEach((mutation) => onChange(root, mutation));
        rootObserver?.observe(root, obsArguments);
    });
    rootObserver.observe(root, obsArguments);
    return rootObserver;
}

function watchForChangeFull(root, obsArguments, onChange)
{
    const rootObserver = new MutationObserver(function (mutations)
    {
        rootObserver.disconnect();
        onChange(root, mutations);
        rootObserver.observe(root, obsArguments);
    });
    rootObserver.observe(root, obsArguments);
    return rootObserver;
}

async function watchForAddedNodes(root, stopAfterFirstMutation, obsArguments, executeAfter)
{
    const rootObserver = new MutationObserver(
        function (mutations)
        {
            rootObserver.disconnect();
            //  LogMessage("timeline mutated");
            mutations.forEach(function (mutation)
            {
                if (mutation.addedNodes == null || mutation.addedNodes.length == 0) { return; }
                executeAfter(mutation.addedNodes);
            });
            if (!stopAfterFirstMutation) { rootObserver.observe(root, obsArguments); }
        });

    rootObserver.observe(root, obsArguments);
}

function findElem(rootElem, query, observer, resolve)
{
    const elem = rootElem.querySelector(query);
    if (elem != null && elem != undefined)
    {
        observer?.disconnect();
        resolve(elem);
    }
    return elem;
}

async function awaitElem(root, query, obsArguments)
{
    return new Promise((resolve, reject) =>
    {
        if (findElem(root, query, null, resolve)) { return; }
        const rootObserver = new MutationObserver((mutes, obs) => {
            findElem(root, query, obs, resolve);
        });
        rootObserver.observe(root, obsArguments);
    });
}

function doOnAttributeChange(elem, onChange, repeatOnce = false)
{
    let rootObserver = new MutationObserver((mutes, obvs) => async function()
    {
        obvs.disconnect();
        await onChange(elem);
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
    let match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) { return match[2].toString(); }
    return null;
}

function getCSSRuleContainingStyle(styleName, selectors, styleCnt = 0, matchingValue = "")
{
    let sheets = document.styleSheets;
    for (let i = 0, l = sheets.length; i < l; i++)
    {
        let curSheet = sheets[i];

        if (!curSheet.cssRules) { continue; }

        for (let j = 0, k = curSheet.cssRules.length; j < k; j++)
        {
            let rule = curSheet.cssRules[j];
            if (styleCnt != 0 && styleCnt != rule.style.length) { return null; }
            if (rule.selectorText && rule.style.length > 0 /* && rule.selectorText.split(',').indexOf(selector) !== -1*/ )
            {
                for (let s = 0; s < selectors.length; s++)
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

function addGlobalStyle(css, id)
{
    if(id && document.querySelector('#' + id)) { return; }
    let head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    if(id) { style.id = id; }
    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else
    {
        style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
    return style;
}

function removeGlobalStyle(id)
{
    let head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    /*
    if(styleElem == null){ return; }
    let head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { console.warn("Couldn't find HEAD element, style not removed, and likely doesn't exist anyways."); return; }
    head.removeChild(styleElem);*/
    let styleElem = document.querySelector('#' + id);
    if(styleElem)
    {
        head.removeChild(styleElem);
    }
}


//<--> BEGIN PROCESSING <-->//

/*async function LoadPrefs()
{
    getUserPref(usePref_blurNSFW, false).then((res) => { toggleNSFW.enabled = res; });
}*/
// 2.0

function ObserveObj(observerConstraints, observeBehaviour, asyncGetElemBehaviour)
{
    this.elem = null;
    this.observer = null;

    this.updateObserver = async function()
    {
        if(this.elem == null)
        {
            this.elem = await asyncGetElemBehaviour();

            observeBehaviour(this.elem, null);

            if(this.observer == null)
            {
                this.observer = watchForChangeFull(this.elem, observerConstraints, (elem, mutes) => {
                    observeBehaviour(elem, mutes)
                });
            }
            else { this.observer?.observe(this.elem, observerConstraints); }
        }
    };

    this.updateObserver();
}

function HeaderData(header)
{
    this.xLabel = '/ X';
    this.title = new ObserveObj(
        argsChildOnly,
        (title, mutes) => { if(title && title.innerText.endsWith(this.xLabel)) { title.innerText = title.innerText.replace(this.xLabel, ''); }},
           function() { return awaitElem(document.head, 'title', argsChildOnly); });

    this.meta = new ObserveObj(argsAll, (meta, mutes) => {
        if(meta && meta.content.endsWith(this.xLabel)) { meta.content = meta.content.replace(this.xLabel, ''); }
    }, function() { return awaitElem(document.head, 'meta[content$="/ X"]', argsChildOnly); });

    this.shortcutIco = new ObserveObj(argsAttrOnly, (shortcutIco, mutes) => {
        if(shortcutIco) { shortcutIco.href = shortcutIco.href.replace('twitter.3', 'twitter.2'); }
    }, function() { return awaitElem(document.head, 'link[rel="shortcut icon"]', argsChildOnly); });

    this.checkObservers = function()
    {
        this.title.updateObserver();
        this.meta.updateObserver();
        this.shortcutIco.updateObserver();
    };
}

var headerData = new HeaderData(document.head);
watchForChangeFull(document.head, argsChildOnly, () => headerData.checkObservers());

async function swapTwitterSplashLogo(reactRoot)
{
    let placeholder = reactRoot.querySelector('div#placeholder svg');
    if(placeholder != null)
    {
        placeholder.innerHTML = twitSVG;
    }

    let logo = await awaitElem(reactRoot, 'header h1 > a svg', argsChildAndSub);
    logo.innerHTML = twitSVG;
}

function replaceWithVX(txt)
{
    if(!toggleMakeLinksVX.enabled) { return txt; }
    if(txt.includes('/status/') && !txt.includes('//vxtwitter.com/'))
    {
        if(!txt.includes('.com'))
        {
            return 'https://vxtwitter.com' + txt;
        }
        return txt.split('?')[0].replace('//twitter.com/','//vxtwitter.com/').replace('//x.com/', '//vxtwitter.com/');
    }
    return txt;
}

document.addEventListener('copy', function(e)
{
    if(toggleMakeLinksVX.enabled)
    {
        let txt = e?.srcElement?.innerText;
        if(txt && (txt.startsWith('http') || txt.startsWith("x.com") || txt.startsWith("twitter.com")))
        {
            txt = replaceWithVX(txt);

            e.clipboardData.setData('text/plain', txt);
            e.preventDefault();
        }
    }
});


(async function ()
{
    'use strict';

    if (isDirectImagePage(window.location.href)) { return; }

    let prefsLoading = loadToggleValues();
    NodeList.prototype.forEach = Array.prototype.forEach;

    await awaitElem(document, 'BODY', argsChildAndSub);

    preCursor = document.body.style.cursor;
    initializeCtxMenu();

    let isIframe = document.body.querySelector('div#app');

    if (isIframe != null)
    {
        awaitElem(isIframe, 'article[role="article"]', argsChildAndSub).then(listenForMediaType);
        return;
    }

    const reactRoot = await awaitElem(document.body, 'div#react-root', argsChildAndSub);
    swapTwitterSplashLogo(reactRoot);
    const main = await awaitElem(reactRoot, 'main[role="main"] div', argsChildAndSub);
    await prefsLoading;

    let layers = reactRoot.querySelector('div#layers');

    awaitElem(reactRoot, 'div#layers', argsChildAndSub).then((layers) =>
    {
        if (!addHasAttribute(layers, "watchingLayers")) { watchForChange(layers, { childList: true, subtree: true }, onLayersChange); }
    });

    addHasAttribute(main, modifiedAttr);

    onMainChange(main);
    watchForChange(main, argsChildOnly, onMainChange);
})();