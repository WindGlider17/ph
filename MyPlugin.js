const URL_BASE = "https://www.pornhub.com";

const PLATFORM_CLAIMTYPE = 3;

const PLATFORM = "PornHub";

var config = {};
// session token
var token = "";
// headers (including cookie by default, since it's used for each session later)
var headers = {"Cookie": ""};

/**
 * Build a query
 * @param {{[key: string]: any}} params Query params
 * @returns {String} Query string
 */
function buildQuery(params) {
	let query = "";
	let first = true;
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			if (first) {
				first = false;
			} else {
				query += "&";
			}

			query += `${key}=${value}`;
		}
	}

	return (query && query.length > 0) ? `?${query}` : ""; 
}


//Source Methods
source.enable = function (conf) {
	config = conf ?? {};
};

source.getHome = function () {
	return getVideoPager('/video', {}, 1);
};



source.searchSuggestions = function(query) {
	if(query.length < 1) return [];
	var json = JSON.parse(getPornhubContentData(URL_BASE + "/video/search_autocomplete?pornstars=true&token=" + token + "&orientation=straight&q=" + query + "&alt=0"));
	if (json.length == 0) return [];
	var suggestions = json.queries;
	// var suggestions = json.channels.forEach((m) => {
	// 	return m.name
	// });
	return suggestions
};

source.getSearchCapabilities = () => {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: []
	};
};

// KEEP
source.search = function (query, type, order, filters) {
	//let sort = order;
	//if (sort === Type.Order.Chronological) {
	//	sort = "-publishedAt";
	//}
//
	//const params = {
	//	search: query,
	//	sort
	//};
//
	//if (type == Type.Feed.Streams) {
	//	params.isLive = true;
	//} else if (type == Type.Feed.Videos) {
	//	params.isLive = false;
	//}

	return getVideoPager("/video/search", {search: query}, 1);
};

source.getSearchChannelContentsCapabilities = function () {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: []
	};
};

source.searchChannelContents = function (channelUrl, query, type, order, filters) {
	throw new ScriptException("This is a sample");

	//return get
};

source.searchChannels = function (query) {

	// todo not working?
	return getChannelPager('/channels/search', {channelSearch: query}, 1);
};


// KEEP
source.isChannelUrl = function (url) {
	return url.includes("/model/") || url.includes("/channels/") || url.includes("/pornstar/");
};

// KEEP
source.getChannel = function (url) {

   // /** @type {import("./types.d.ts").Channel} */
    //const j = getPornstarInfo(URL_BASE + url);
	if (!url.startsWith("htt")) {
		url = URL_BASE + url;
	}

	var channelUrlName = url.split("/")[4]
	
	var info;
	if(url.includes("/channels/")) {
		info = getChannelInfo(url);
	} else {
		info = getPornstarInfo(url);
	}

    return new PlatformChannel({
        id: new PlatformID(PLATFORM, channelUrlName, config.id, PLATFORM_CLAIMTYPE),
        name: info.channelName,
        thumbnail: info.channelThumbnail,
        banner: info.channelBanner,
        subscribers: info.channelSubscribers,
        description: info.channelDescription,
        url: info.channelUrl,
        links: info.channelLinks,
	//views: info.channelViews
    })
}



source.getChannelContents = function (url, type, order, filters) {
	// channels have different format than model/pornstar
	if(url.includes("/channels/")) {
		return getChannelVideosPager(url + "/videos", {}, 1);
	} else if(url.includes("/model/")){
		return getModelVideosPager(url + "/videos", {}, 1);
	} else {
		return getPornstarVideosPager(url + "/videos/upload", {}, 1);
	}
};


source.isContentDetailsUrl = function(url) {
	return url.startsWith(URL_BASE + "/view_video.php?viewkey=");
};




const supportedResolutions = {
	'1080': { width: 1920, height: 1080 },
	'720': { width: 1280, height: 720 },
	'480': { width: 854, height: 480 },
	'360': { width: 640, height: 360 },
	'240': { width: 352, height: 240 },
	'144': { width: 256, height: 144 }
};



// TODO improve
source.getContentDetails = function (url) {

	var html = getPornhubContentData(url);

	let flashvarsMatch = html.match(/var\s+flashvars_\d+\s*=\s*({.+?});/);

	let flashvars = {};
	if (flashvarsMatch) {
		flashvars = JSON.parse(flashvarsMatch[1]);
	}
	//log(flashvars);

	var mediaDefinitions = flashvars["mediaDefinitions"];
	//log(mediaDefinitions);
	var sources = [];


	for (const mediaDefinition of mediaDefinitions) {
		if(typeof mediaDefinition.defaultQuality === "boolean") {
			// sometimes quality is [] instead of a bool or number
			if(typeof mediaDefinition.quality === "object") continue;
			//log(mediaDefinition.quality)
			let width = supportedResolutions[`${mediaDefinition.quality}`].width;
			let height = supportedResolutions[`${mediaDefinition.quality}`].height;
			sources.push(new HLSSource({
				name: `${width}x${height}`,
				width: width,
				height: height,
				url: mediaDefinition.videoUrl,
				duration: flashvars.video_duration ?? 0,
				priority: true
			}));
		} else if(typeof mediaDefinition.defaultQuality === "number") {
			// doesn't work for now
			// sources.push(new VideoUrlSource({
			// 	name: "mp4",
			// 	url: mediaDefinition.videoUrl,
			// 	width: supportedResolutions[mediaDefinition.defaultQuality].width,
			// 	height: supportedResolutions[mediaDefinition.defaultQuality].height,
			// 	duration: flashvars.video_duration,
			// 	container: "video/mp4"
			// }));
		} else {
			continue;
		}
	}


	var dom = domParser.parseFromString(html);

	var ldJson = JSON.parse(dom.querySelector('script[type="application/ld+json"]').text)

	var description = ldJson.description;

	var userAvatar = dom.getElementsByClassName("userAvatar")[0].querySelector("img").getAttribute("src")

	var userInfoNode = dom.getElementsByClassName("userInfo")[0];

	var channelUrlId = userInfoNode.querySelector("div.usernameWrap a").getAttribute("href")[2]
	
	var subscribersStr = userInfoNode.querySelectorAll("span")[2].text;
	var subscribers = parseStringWithKorMSuffixes(subscribersStr);
	var displayName = userInfoNode.querySelector("a").text;
	var channelUrl = userInfoNode.querySelector("a").getAttribute("href");


	var views = parseInt(ldJson.interactionStatistic[0].userInteractionCount.replace(/,/g, ""))

	var videoId = flashvars.playbackTracking.video_id.toString();

	// note: subtitles are in https://www.pornhub.com/video/caption?id={videoId}&language_id=1&caption_type=0 if present
 
	return new PlatformVideoDetails({
		id: new PlatformID(PLATFORM, videoId, config.id),
		name: flashvars.video_title,
		thumbnails: new Thumbnails([new Thumbnail(flashvars.image_url, 0)]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, channelUrlId, config.id), //obj.channel.name, config.id), 
			displayName,//obj.channel.displayName, 
			channelUrl,//obj.channel.url,
			userAvatar ?? "",
			subscribers ?? ""),//obj.channel.avatar ? `${plugin.config.constants.baseUrl}${obj.channel.avatar.path}` : ""),
		datetime: Math.round((new Date(ldJson.uploadDate)).getTime() / 1000),
		duration: flashvars.video_duration,
		viewCount: views,
		url: flashvars.link_url,
		isLive: false,
		description: description,
		video: new VideoSourceDescriptor(sources),
		//subtitles: subtitles
	});
};



// the only things you need for a valid session are as follows:
// 1.) token
// 2.) cookie labeled "ss" in headers
// this will allow you to get search suggestions!!
function refreshSession() {
	const resp = http.GET(URL_BASE, {});
	if (!resp.isOk)
		throw new ScriptException("Failed request [" + URL_BASE + "] (" + resp.code + ")");
	else {
		var dom = domParser.parseFromString(resp.body);
		
		// Add null check for search input

		const searchInput = dom.querySelector("#searchInput");
		if (searchInput) {
			token = searchInput.getAttribute("data-token");
		} else {
			log("Warning: #searchInput not found, token extraction failed");
			// Try alternative selector or method
		}
		
		// Add null check for meta tagAdd commentMore actions
		const metaTag = dom.querySelector("meta[name=\"adsbytrafficjunkycontext\"]");
		if (metaTag) {
			const adContextInfo = metaTag.getAttribute("data-info");
			headers["Cookie"] = `ss=${JSON.parse(adContextInfo)["session_id"]}`;
		} else {
			log("Warning: meta tag not found, session cookie extraction failed");
			// Try alternative method
		}

		log("New session created")


	}
}

function getVideoId(dom) {
	var videoId =  dom.querySelector("div#player").getAttribute("data-video-id");
	return videoId
}

//Comments
source.getComments = function (url) {
	var html = getPornhubContentData(url);
	var dom = domParser.parseFromString(html);
	var videoId = getVideoId(dom);
	if(token == "") refreshSession();
	return getCommentPager(`/comment/show?id=${videoId}&popular=0&what=video&token=${token}`, {}, 1);
}


source.getSubComments = function (comment) {
	//todo
	throw new ScriptException("This is a sample");
}

function parseStringWithKorMSuffixes(subscriberString) {
    const numericPart = parseFloat(subscriberString);

    if (subscriberString.includes("K")) {
        return Math.floor(numericPart * 1000);
    } else if (subscriberString.includes("M")) {
        return Math.floor(numericPart * 1000000);
    } else {
        // If there's no "K" or "M", assume the number is already in the desired format
        return Math.floor(numericPart);
    }
}




function getCommentPager(path, params, page) {
	log(`getCommentPager page=${page}`, params)

	const count = 10;
	const page_end = (page ?? 1) * count;
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var comments = getComments(html);
	// if no comments, return empty pager
	if (comments.total === 0) return new PornhubCommentPager();
	
	return new PornhubCommentPager(comments.comments.map(c => {
		return new Comment({
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, c.username, config.id), 
				c.username, 
				"", 
				c.avatar,
				"",),
			message: c.message,
			rating: new RatingLikesDislikes(c.voteUp, c.voteDown),
			date: Math.round(c.date.getTime() / 1000),
			replyCount: c.totalReplies,
			context: { id: c.id }
		});
	}), comments.total > page_end, path, params, page);
}




function getComments(html) {

	var dom = domParser.parseFromString(html);

	var comments = []

	const total = parseInt(dom.querySelector("div#cmtWrapper div.cmtHeader h2 span").textContent.trim().replace("(", "").replace(")", ""));
	if (total > 0) {
		// Loop through each comment block
		// todo nested blocks
		dom.querySelectorAll('div#cmtContent div.commentBlock').forEach(commentBlock => {
			const id = commentBlock.getAttribute("class").match(/commentTag(\d+)/)[1];

			const avatar = commentBlock.querySelector("img").getAttribute("src");
			const username = commentBlock.querySelector('.usernameLink').textContent.trim();
			const date = parseRelativeDate(commentBlock.querySelector('div.date').textContent.trim());
			const message = commentBlock.querySelector('.commentMessage span').textContent.trim();
			const voteUp = parseInt(commentBlock.querySelector('span.voteTotal').textContent.trim());
			var isVoteDownPresent = commentBlock.querySelectorAll('div.actionButtonsBlock span') !== null;

			var voteDown = 0;
			if (isVoteDownPresent) {
				voteDown = parseInt(commentBlock.querySelectorAll('div.actionButtonsBlock span')[1].textContent.trim());
			}
		

			// Push comment details to the comments array
			comments.push({
				id,
				avatar,
				username,
				date,
				message,
				voteUp,
				voteDown
			});
		});


		return {
			total: total,
			comments: comments
		};

	} else {

		return {
			total: 0,
			comments: 0
		};
	}

}


function parseRelativeDate(relativeDate) {
    const now = new Date();
    const lowerCaseRelativeDate = relativeDate.toLowerCase();

    if (lowerCaseRelativeDate.includes('1 second ago')) {
        return new Date(now - 1000);
    } else if (lowerCaseRelativeDate.includes('1 minute ago')) {
        return new Date(now - 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('1 hour ago')) {
        return new Date(now - 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('1 day ago')) {
        return new Date(now - 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('yesterday')) {
        return new Date(now - 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('1 week ago')) {
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('1 month ago')) {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return oneMonthAgo;
    } else if (lowerCaseRelativeDate.includes('1 year ago')) {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        return oneYearAgo;
    } else if (lowerCaseRelativeDate.includes('seconds ago')) {
        const secondsAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - secondsAgo * 1000);
    } else if (lowerCaseRelativeDate.includes('minutes ago')) {
        const minutesAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - minutesAgo * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('hours ago')) {
        const hoursAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - hoursAgo * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('days ago')) {
        const daysAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('weeks ago')) {
        const weeksAgo = parseInt(lowerCaseRelativeDate);
        return new Date(now - weeksAgo * 7 * 24 * 60 * 60 * 1000);
    } else if (lowerCaseRelativeDate.includes('months ago')) {
        const monthsAgo = parseInt(lowerCaseRelativeDate);
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - monthsAgo);
        return oneMonthAgo;
    } else if (lowerCaseRelativeDate.includes('years ago')) {
        const yearsAgo = parseInt(lowerCaseRelativeDate);
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - yearsAgo);
        return oneYearAgo;
    }

    // Handle additional cases or return null if the format is not recognized
    return 0;
}


function getChannelInfo(url) {
	var html = getPornhubContentData(url);
	let dom = domParser.parseFromString(html);

	var channelThumbnail = dom.getElementById("getAvatar").getAttribute("src");
	var channelBanner = dom.getElementById("coverPictureDefault").getAttribute("src");
	var channelName = dom.querySelector("h1").textContent.trim();

	var statsNode = dom.getElementById("stats");
	
	var channelSubscribers = parseInt(statsNode.childNodes[1].textContent.trim().replace(/,/g, ''));
	var channelViews = parseInt(statsNode.childNodes[0].textContent.trim().replace(/,/g, ''));

	var channelDescription = dom.querySelector(".cdescriptions").childNodes[0].textContent.trim()


	return {
		channelName: channelName,
		channelThumbnail: channelThumbnail,
		channelBanner: channelBanner,
		channelSubscribers: channelSubscribers,
		channelDescription: channelDescription,
		channelUrl: url,
		channelLinks: [],
		//channelViews: channelViews
	}
}



function getPornstarInfo(url) {
	var html = getPornhubContentData(url);
	let dom = domParser.parseFromString(html);

	const channelThumbnail = dom.getElementById("getAvatar").getAttribute("src");
	const channelBanner = dom.getElementById("coverPictureDefault").getAttribute("src");
	
	const channelName = dom.querySelector("div.name > h1").textContent.trim();
	
	var channelDescription;
	const channelDescriptionElement = dom.querySelector("section.aboutMeSection > div:not([class])")
	if(!channelDescriptionElement) {
		channelDescription = "";
	} else {
		channelDescription = channelDescriptionElement.textContent;
	}

	const statsNode = dom.querySelector("div.infoBoxes");
	const channelSubscribers = parseNumberSuffix(statsNode.querySelector("div[data-title^=Subscribers] > span.big").textContent.trim());
	const channelViews = parseNumberSuffix(statsNode.querySelector("div[data-title^=Video] > span.big").textContent.trim());

	return {
		channelName: channelName,
		channelThumbnail: channelThumbnail,
		channelBanner: channelBanner,
		channelSubscribers: channelSubscribers,
		channelDescription: channelDescription,
		channelUrl: url,
		channelLinks: [],
		//channelViews: channelViews
	}
}




// KEEP
class PornhubVideoPager extends VideoPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params,  page});
	}
	
	nextPage() {
		return getVideoPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}


// KEEP
class PornhubChannelVideosPager extends VideoPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params,  page});
	}

	nextPage() {
		if(this.context.path.includes("/channels/")) {
			return getChannelVideosPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
		} else if(this.context.path.includes("/model/")) {
			return getModelVideosPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
		}
		else {
			return getPornstarVideosPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
		}
	}
}



// KEEP
class PornhubChannelPager extends ChannelPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}
	
	nextPage() {
		return getChannelPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}


// KEEP
class PornhubCommentPager extends CommentPager {
	constructor(results, hasMore, path, params, page) {
		super(results, hasMore, { path, params, page });
	}
	
	nextPage() {
		return getCommentPager(this.context.path, this.context.params, (this.context.page ?? 1) + 1);
	}
}




function getChannelPager(path, params, page) {

	log(`getChannelPager page=${page}`, params)

	const count = 40;
	const page_end = (page ?? 1) * count;
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var channels = getChannels(html, "searchChannelsSection");


	return new PornhubChannelPager(channels.channels.map(c => {
			return new PlatformAuthorLink(new PlatformID(PLATFORM, c.name, config.id), 
				c.displayName, 
				URL_BASE + c.url, 
				c.avatar ?? "",
				c.subscribers);
		}), channels.hasNextPage, path, params, page);
}

function getChannels(html) {

	var dom = domParser.parseFromString(html);

	var resultArray = []

	dom.getElementById("searchChannelsSection").childNodes.forEach((li) => {

			var avatar = li.querySelector("div.avatar a.usernameLink img").getAttribute("src");
			var displayName = li.querySelector("div.descriptionContainer li a.usernameLink").textContent.trim()
			var url = li.querySelector("div.descriptionContainer li a.usernameLink").getAttribute("href");
			var subscribers = parseInt(li.querySelector("div.descriptionContainer li span").textContent.trim().replace(/\,/, ""));
			var name = url.split("/")[1];

			resultArray.push({
				subscribers: subscribers,
				name: name,
				url: url,
				displayName: displayName,
				avatar: avatar,
			});
	});
	

	var hasNextPage = false; 
	var pageNextNode = dom.getElementsByClassName("page_next");
	if (pageNextNode.length > 0) {
		hasNextPage = pageNextNode[0].firstChild.getAttribute("href") == "" ? false : true;
	}

	return {
		hasNextPage: hasNextPage,
		channels: resultArray
	};
}

// todo: maybe improve?
function getChannelVideosPager(path, params, page) {
	log(`getChannelVideosPager page=${page}`, params)

	const count = 36;
	const page_end = (page ?? 1) * count;
	params = { ... params, page }

	const url = path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);
	
	var vids = getChannelContents(html);
	return _buildPornhubChannelVideosPager(vids, vids.totalElemsPages > page_end, path, params, page)
	
}

function getModelVideosPager(path, params, page) {
	log(`getModelVideosPager page=${page}`, params)
	params = { ... params, page }

	const url = path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var vids = getModelContents(html);

	return _buildPornhubChannelVideosPager(vids, vids.hasNextPage, path, params, page)
}

function getPornstarVideosPager(path, params, page) {
	log(`getPornstarVideosPager page=${page}`, params)

	const count = 40;
	const page_end = (page ?? 1) * count;
	params = { ... params, page }

	const url = path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var vids = getPornstarContents(html);
	return _buildPornhubChannelVideosPager(vids, vids.totalElemsPages > page_end, path, params, page)
}

function _buildPornhubChannelVideosPager(vids, hasNextPage, path, params, page) {
	return new PornhubChannelVideosPager(vids.videos.map(v => {
		return new PlatformVideo({
			id: new PlatformID(PLATFORM, v.id, config.id),
			name: v.title ?? "",
			thumbnails: new Thumbnails([new Thumbnail(v.thumbnailUrl, 0)]),
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, v.authorInfo.authorName, config.id), 
				v.authorInfo.authorName, 
				path.split("/")[4],
				v.authorInfo.avatar),
			datetime: undefined,//Math.round((new Date(v.publishedAt)).getTime() / 1000),
			duration: v.duration,
			viewCount: v.views,
			url: URL_BASE + v.videoUrl,
			isLive: false
		});

	}), hasNextPage, path, params, page);
}


function getChannelContents(html) {
	var dom = domParser.parseFromString(html);

	var statsNodes = dom.querySelectorAll("div#stats div.info.floatRight");

	var total = parseInt(statsNodes[2].textContent.split(" VIDEOS")[0]);

	var resultArray = []

	var authorInfo = {
		authorName: dom.querySelector("div.title h1").textContent.trim(),
		avatar: dom.querySelector("img#getAvatar").getAttribute("href")
	}

	dom.getElementById("showAllChanelVideos").childNodes.forEach((li) => {

		var title = li.querySelector("span.title a").textContent.trim()
		var videoUrl = li.querySelector("span.title a").getAttribute("href");
		var thumbnailUrl = li.querySelector("img").getAttribute("src");
		var videoId = li.getAttribute("data-video-id");
		var duration = parseDuration(li.querySelector("var.duration").textContent.trim());
		var views = parseStringWithKorMSuffixes(li.querySelector("div.videoDetailsBlock span.views var").textContent.trim())

		resultArray.push({
			id: videoId,
			videoUrl: videoUrl,
			title: title,
			thumbnailUrl: thumbnailUrl,
			duration: duration,
			authorInfo: authorInfo,
			views: views,
		});

	});
	//log(`getChannelContents total: ${total}`);
	return {
		totalElemsPages: total,
		videos: resultArray
	};
}

function getPornstarContents(html) {
	var dom = domParser.parseFromString(html);
	
	// "Showing 1-40 of 52"
	var showingInfo = dom.querySelector("div.showingInfo").textContent.trim();
	if (showingInfo.length === 0) {
		showingInfo = dom.querySelector
	}
	// "52"
	const total = parseInt(showingInfo.split(" of ").slice(-1), 10);

	var resultArray = []

	var authorInfo = {
		authorName: dom.querySelector("h1[itemprop=name]").textContent.trim(),
		avatar: dom.querySelector("img#getAvatar").getAttribute("src")
	}

	dom.querySelector("div.videoUList > ul").childNodes.forEach((li) => {
		var title = li.querySelector("span.title a").textContent.trim()
		var videoUrl = li.querySelector("span.title a").getAttribute("href");
		var thumbnailUrl = li.querySelector("img").getAttribute("src");
		var videoId = li.getAttribute("data-video-id");
		var duration = parseDuration(li.querySelector("var.duration").textContent.trim());
		var views = parseStringWithKorMSuffixes(li.querySelector("div.videoDetailsBlock span.views var").textContent.trim())

		resultArray.push({
			id: videoId,
			videoUrl: videoUrl,
			title: title,
			thumbnailUrl: thumbnailUrl,
			duration: duration,
			authorInfo: authorInfo,
			views: views,
		});

	});

	return {
		totalElemsPages: total,
		videos: resultArray
	};
}

function getModelContents(html) {
	var dom = domParser.parseFromString(html);
	var hasNextPage;

	const pageNext = dom.querySelector("li.page_next > a");
	if (pageNext) {
		hasNextPage = pageNext.getAttribute("href") !== "";
	} else {
		hasNextPage = false;
	}

	var resultArray = []

	var authorInfo = {
		authorName: dom.querySelector("h1[itemprop=name]").textContent.trim(),
		avatar: dom.querySelector("img#getAvatar").getAttribute("src")
	}

	dom.querySelector("div.videoUList > ul").childNodes.forEach((li) => {
		var title = li.querySelector("span.title a").textContent.trim()
		var videoUrl = li.querySelector("span.title a").getAttribute("href");
		var thumbnailUrl = li.querySelector("img").getAttribute("src");
		var videoId = li.getAttribute("data-video-id");
		var duration = parseDuration(li.querySelector("var.duration").textContent.trim());
		var views = parseStringWithKorMSuffixes(li.querySelector("div.videoDetailsBlock span.views var").textContent.trim())

		resultArray.push({
			id: videoId,
			videoUrl: videoUrl,
			title: title,
			thumbnailUrl: thumbnailUrl,
			duration: duration,
			authorInfo: authorInfo,
			views: views,
		});

	});

	return {
		hasNextPage: hasNextPage,
		videos: resultArray
	};
}

// todo: sort
function getVideoPager(path, params, page) {
	var count;
	var start;
	log(`getVideoPager page=${page}`, params)
	// first page has 32 elements
	if(page === 1) {
		count = 32;
		start = count;
	// the rest of the pages have up to 44
	} else {
		count = 44;
		start = 32 + ((page - 1) * count)
	}
	params = { ... params, page }

	const url = URL_BASE + path;
	const urlWithParams = `${url}${buildQuery(params)}`;

	var html = getPornhubContentData(urlWithParams);

	var vids = getVideos(html, "videoSearchResult");
	
	return new PornhubVideoPager(vids.videos.map(v => {
		return new PlatformVideo({
			id: new PlatformID(PLATFORM, v.id, config.id),
			name: v.title ?? "",
			thumbnails: new Thumbnails([new Thumbnail(v.thumbnailUrl, 0)]),
			author: new PlatformAuthorLink(new PlatformID(PLATFORM, v.authorInfo.authorName, config.id), 
				v.authorInfo.authorName, 
				v.authorInfo.channel,
				""),
			datetime: undefined,//Math.round((new Date(v.publishedAt)).getTime() / 1000),
			duration: v.duration,
			viewCount: v.views,
			url: v.videoUrl,
			isLive: false
		});

	}), true, path, params, page);
}


// KEEP
function getVideos(html, ulId) {

	let node = domParser.parseFromString(html, "text/html");
	
	// Find the ul element with id ulId
	var ulElement = node.getElementById(ulId);

	var total = 1; 

	var pagingIndication = node.getElementsByClassName("showingCounter")[0];
	if (pagingIndication !== undefined) {
		pagingIndication = node.getElementsByClassName("showingCounter")[0];
		var indexOfTotalStr = pagingIndication.indexOf("of "); // "showing XX-ZZ of TOTAL"
		total = parseInt(pagingIndication.substring(indexOfTotalStr + 3), 10);
		log(`getVideos total: ${total}`);
	}

	var resultArray = []

	// Check if the ul element with id "singleFeedSection" exists

    // Check if the ul element exists
    if (ulElement) {
        // Get all li elements inside the ul with class "pcVideoListItem" (new class)
        const liElements = ulElement.querySelectorAll("li.pcVideoListItem");

        log(`getVideos found ${liElements.length} li elements`);

        // Iterate through each li element
        liElements.forEach(function (li) {
            // Get the data-video-id attribute of the li element for the videoId
            const videoId = li.getAttribute("data-video-id");

            // Ensure a valid videoId is found and it's not the ad element (which might have no data-video-id or a non-numeric id)
            if (videoId && !isNaN(videoId)) {
                // Find the first <a> tag inside the li which is the video link
                const aElement = li.querySelector('a.js-linkVideoThumb');

                if (aElement) {
                    // Get the "href" attribute as "videoUrl"
                    const videoUrl = URL_BASE + aElement.getAttribute('href');

                    // Find the <img> tag inside the <a>
                    const imgElement = aElement.querySelector('img.js-videoThumb');

                    if (imgElement) {
                        // Get the "src" attribute as "thumbnailUrl"
                        const thumbnailUrl = imgElement.getAttribute('src');

                        // Title can be from the img's alt or data-title, or the a tag's data-title, or the .thumbnailTitle span
                        const title = imgElement.getAttribute("alt") || imgElement.getAttribute("data-title") || aElement.getAttribute("data-title");

                        // Get the duration string from the <var> tag with class "duration"
                        const durationVar = aElement.querySelector(".duration");
                        const durationStr = durationVar ? durationVar.textContent.trim() : "0:00";
                        const duration = parseDuration(durationStr);

                        // Get the views string from the <var> tag inside the span with class "views"
                        const viewsSpan = li.querySelector(".views var");
                        const viewsStr = viewsSpan ? viewsSpan.textContent.trim() : "0";
                        const views = parseNumberSuffix(viewsStr);

                        // Get author information
                        const authorLink = li.querySelector(".usernameWrap a");
                        let authorInfo = {
                            channel: "",
                            authorName: ""
                        };
                        if (authorLink) {
                            authorInfo.channel = URL_BASE + authorLink.getAttribute("href");
                            authorInfo.authorName = authorLink.textContent.trim();
                        }

                        // Create an object with the desired properties and push it to the result array
                        resultArray.push({
                            id: videoId,
                            videoUrl: videoUrl,
                            title: title,
                            thumbnailUrl: thumbnailUrl,
                            duration: duration,
                            authorInfo: authorInfo,
                            views: views,
                        });
                    }
                }
            }
        });
    }

	log(resultArray.length + " videos found");

	return {
		totalElemsPages: undefined,
		videos: resultArray
	};

}


function getPornhubContentData(url) {
	if(headers["Cookie"].length === 0) {
		refreshSession();
	}
	else {
		log("Session is good");
	}
	const resp = http.GET(url, headers);
	if (!resp.isOk)
		throw new ScriptException("Failed request [" + url + "] (" + resp.code + ")");
	else {
		return resp.body
	}
}

function parseNumberSuffix(numStr) {

	var mul = 1;
	if (numStr.includes("K")) {
		mul = 1000;
	}
	if (numStr.includes("M")) {
		mul = 1000000;
	}

	var out = parseFloat(numStr.slice(0, -1)) * mul;
	return out;
}

function parseDuration(durationStr) {
	var splitted = durationStr.split(":");
	var mins = parseInt(splitted[0]);
	var secs = parseInt(splitted[1]);

	return 60 * mins + secs;
}



log("LOADED");