(function() {
    "use strict";
    var twitch = window.Twitch.ext;
    var DEV_CHANNEL = '24261394';
    window.EmotesModel = {
        BTTV_SIZES: [
           1,
           2,
           3
        ],
        visibleCredits: [],
        setAuth: function(auth) {
            this.channelId = auth.channelId;
            this.clientId = auth.clientId;
            this.apiToken = auth.helixToken;
        },
        loadConfig: function() {
        },

        isPopout: function() {
            return location.search.includes("popout=true");
        },

        isProd: function() {
            return location.search.includes("state=released");
        },

        getTierFromPrice: function(price) {
            var numericPrice = parseFloat(price.substr(1));
            if(numericPrice >= 24.99) {
                return 3;
            }
            else if(numericPrice >= 9.99) {
                return 2;
            }
            return 1;
        },

        makeAPIRequest: function(endpoint) {
            return fetch('https://api.twitch.tv/helix/' + endpoint, {
                headers: {
                    'Client-ID': this.clientId,
                    Authorization: 'Extension ' + this.apiToken
                }
            }).then(function(response) {
                if(response.ok && response.status) {
                    return response.json();
                }
                throw new Error("API request failed");
            });
        },

        getChannelInfo: function() {
            return this.makeAPIRequest("users?id=" + this.channelId).then(function(data) {
                if(data.data.length) {
                    var user = data.data[0];
                    EmotesModel.canHaveEmotes = !!user.broadcaster_type;
                    EmotesModel.canHaveCheermotes = user.broadcaster_type === "partner";
                    EmotesModel.username = user.login;
                    if(!EmotesModel.isProd() && EmotesModel.channelId == DEV_CHANNEL) {
                        EmotesModel.canHaveEmotes = true;
                        EmotesModel.canHaveCheermotes = true;
                        EmotesModel.overrideChannelId = '26610234';
                    }
                }
                else {
                    throw new Error("No user info found");
                }
            }, function() {
                throw new Error("could not load user info");
            });
        },

        formatTier: function(tier, theme, type) {
            var srcset = Object.keys(tier.images[theme][type]).map(function(scale) {
                return tier.images[theme][type][scale] + ' ' + scale + 'x';
            }).join(', ');
            return {
                url: tier.images[theme][type]['1'],
                srcset: srcset
            };
        },

        getCheerEmotes: function() {
            if(!this.canHaveEmotes || !this.canHaveCheermotes) {
                return Promise.reject("User can not have cheer emotes");
            }
            return this.makeAPIRequest('bits/cheermotes?broadcaster_id=' + (this.overrideChannelId || this.channelId)).then(function(data) {
                var cheermotes = data.data.filter(function(emote) {
                    return emote.type === 'channel_custom' && emote.tiers.some(function(tier) {
                        return tier.can_cheer;
                    });
                }).sort(function (a, b) {
                    return b.order - a.order;
                });
                var formatted = [];
                var cheermote;
                var tier;
                for(var i = 0; i < cheermotes.length; ++i) {
                    cheermote = cheermotes[i];
                    for(var t = 0; t < cheermote.tiers.length; ++t) {
                        tier = cheermote.tiers[t];
                        if(tier.can_cheer) {
                            formatted.push({
                                name: cheermote.prefix + tier.id,
                                dark: {
                                    static: EmotesModel.formatTier(tier, 'dark', 'static'),
                                    animated: EmotesModel.formatTier(tier, 'dark', 'animated')
                                },
                                light: {
                                    static: EmotesModel.formatTier(tier, 'light', 'static'),
                                    animated: EmotesModel.formatTier(tier, 'light', 'animated')
                                }
                            });
                        }
                    }
                }
                return formatted;
            });
        },

        emotesV2Url: function(id, theme, type, size) {
            return 'https://static-cdn.jtvnw.net/emoticons/v2/' + id + '/' + type + '/' + theme + '/' + size;
        },

        formatTierV2: function(id, theme, type) {
            return {
                url: this.emotesV2Url(id, theme, type, '1.0'),
                srcset: this.emotesV2Url(id, theme, type, '1.0') + ' 1x, ' + this.emotesV2Url(id, theme, type, '2.0') + ' 2x, ' + this.emotesV2Url(id, theme, type, '3.0') + ' 4x'
            };
        },

        getEmotes: function() {
            if(!this.canHaveEmotes) {
                return Promise.reject("User can not have Twitch emotes");
            }
            return this.makeAPIRequest('chat/emotes/?broadcaster_id=' + (this.overrideChannelId || this.channelId)).then(function(data) {
                var sortedEmotes = {};
                var emote;
                var key;
                for(var i = 0; i < data.data.length; ++i) {
                    emote = data.data[i];
                    key = emote.emote_type === 'subscriptions' ? emote.emote_type + emote.tier : emote.emote_type;
                    if(!Array.isArray(sortedEmotes[key])) {
                        sortedEmotes[key] = [];
                    }
                    sortedEmotes[key].push({
                        name: emote.name,
                        dark: {
                            static: EmotesModel.formatTierV2(emote.id, 'dark', 'static'),
                            animated: EmotesModel.formatTierV2(emote.id, 'dark', 'default'),
                        },
                        light: {
                            static: EmotesModel.formatTierV2(emote.id, 'light', 'static'),
                            animated: EmotesModel.formatTierV2(emote.id, 'light', 'default')
                        }
                    });
                }
                return sortedEmotes;
            });
        },

        getBTTVEmotes: function() {
            return fetch('https://api.betterttv.net/3/cached/users/twitch/' + this.channelId).then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("Could not load bttv channel info");
            }).then(function(json) {
                return json.channelEmotes.concat(json.sharedEmotes).map((e) => {
                    return {
                        name: e.code,
                        url: `//cdn.betterttv.net/emote/${e.id}/1x`,
                        srcset: EmotesModel.BTTV_SIZES.map(function(s) {
                            return `//cdn.betterttv.net/emote/${e.id}/${s}x ${s}x`;
                        }).join(','),
                        animated: e.imageType === 'gif'
                    };
                });
            });
        },

        getFFZEmotes: function() {
            return fetch('https://api.frankerfacez.com/v1/room/id/' + this.channelId).then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("Could not load ffz channel info");
            }).then(function(json) {
                return json.sets[json.room.set].emoticons.map(function(emote) {
                    return {
                        name: emote.name,
                        url: emote.urls["1"],
                        srcset: Object.keys(emote.urls).map(function(s) {
                            return emote.urls[s] + ' ' + s + 'x';
                        }).join(', '),
                        height: emote.height,
                        width: emote.width,
                        animated: false
                    };
                });
            })
        }
    };

    twitch.onAuthorized(function(auth) {
        EmotesModel.setAuth(auth);
    });
})();
