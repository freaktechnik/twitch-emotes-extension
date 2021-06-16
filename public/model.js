(function() {
    "use strict";
    var twitch = window.Twitch.ext;
    var DEV_CHANNEL = '24261394';
    window.EmotesModel = {
        SIZES: [
            1,
            2,
            3,
            4
        ],
        BTTV_SIZES: [
           1,
           2,
           3
        ],
        visibleCredits: [],
        setAuth: function(auth) {
            this.channelId = auth.channelId;
            this.clientId = auth.clientId;
        },

        ebsURL: 'https://te.humanoids.be/emotesets/',
        loadConfig: function() {
            if(twitch.configuration.global) {
                this.ebsURL = JSON.parse(twitch.configuration.global.content).ebs;
            }
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

        getChannelInfo: function() {
            return fetch('https://api.twitch.tv/helix/users?id=' + this.channelId, {
                headers: {
                    "Client-ID": EmotesModel.clientId
                }
            }).then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("could not load user status");
            }).then(function(user) {
                if(user.data.length) {
                    EmotesModel.canHaveEmotes = !!user.data[0].broadcaster_type.length;
                    EmotesModel.canHaveCheermotes = user.data[0].broadcaster_type === "partner";
                    EmotesModel.username = user.data[0].login;
                    if(!EmotesModel.isProd() && EmotesModel.channelId == DEV_CHANNEL) {
                        EmotesModel.canHaveEmotes = true;
                        EmotesModel.canHaveCheermotes = true;
                    }
                }
                else {
                    throw new Error("no user returned");
                }
            });
        },

        makeSrcSet: function(images) {
            var sizes = Object.keys(images);
            return sizes.map(function(size) {
                var density = size.split('_', 1)[1];
                return images[size] + ' ' + density;
            }).join(', ');
        },

        getCheerEmotes: function() {
            if(!this.canHaveEmotes || !this.canHaveCheermotes) {
                return Promise.reject("User can not have cheer emotes");
            }
            function formatTier(tier, theme, type) {
                return {
                    url: tier.images[theme][type]['1'],
                    srcset: Object.keys(tier.images[theme][type]).map(function(s) {
                        return `${tier.images[theme][type][s]} ${s}x`;
                    }).join(', ')
                };
            }
            var channelId = this.channelId;
            if(!EmotesModel.isProd() && EmotesModel.channelId == DEV_CHANNEL) {
                channelId = '26610234';
            }
            return fetch('https://api.twitch.tv/helix/bits/cheermotes?broadcaster_id=' + channelId, {
                headers: {
                    "Client-ID": EmotesModel.clientId,
                }
            }).then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("Could not get cheer emote details");
            }).then(function(json) {
                var cheerEmotes = json.data
                    .filter(function(emote) {
                        return emote.type === "channel_custom";
                    })
                    .sort(function(emoteA, emoteB) {
                        return emoteB.order - emoteA.order;
                    });
                var ret = [];
                var j;
                var tier;
                var cheerEmote;
                for(var i = 0; i < cheerEmotes.length; ++i) {
                    cheerEmote = cheerEmotes[i];
                    for(j = 0; j < cheerEmote.tiers.length; ++j) {
                        tier = cheerEmote.tiers[j];
                        if(tier.can_cheer) {
                            ret.push({
                                name: cheerEmote.prefix + tier.id,
                                dark: {
                                    static: formatTier(tier, 'dark', 'static'),
                                    animated: formatTier(tier, 'dark', 'animated')
                                },
                                light: {
                                    static: formatTier(tier, 'light', 'static'),
                                    animated: formatTier(tier, 'light', 'animated')
                                }
                            });
                        }
                    }
                }
                return ret;
            });
        },

        getEmotes: function() {
            if(!this.canHaveEmotes) {
                return Promise.reject("User can not have Twitch emotes");
            }
            //TODO use official Twitch API if there ever is one (hint, hint)
            return fetch(this.ebsURL + this.channelId + '.json').then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("Could not get sub tier details");
            }).then(function(json) {
                return fetch('https://api.twitch.tv/helix/chat/emotes/set?emote_set_id=' + Object.values(json).join('&emote_set_id='), {
                    headers: {
                        "Client-ID": EmotesModel.clientId,
                    }
                }).then(function(r) {
                    if(r.ok && r.status === 200) {
                        return Promise.all([
                            r.json(),
                            json
                        ]);
                    }
                    throw new Error("Could not get emote sets");
                });
            }).then((data) => {
                var planKeys = Object.keys(data[1]);
                var ret = [];
                var key;
                var emote;
                var bySet = {};
                for(var j = 0; j < data[0].data.length; ++j) {
                    emote = data[0].data[j];
                    if(!bySet[emote.emote_set_id]) {
                        bySet[emote.emote_set_id] = [];
                    }
                    bySet[emote.emote_set_id].push(emote);
                }
                for(var i = 0; i < planKeys.length; ++i) {
                    key = planKeys[i];
                    if(bySet.hasOwnProperty(data[1][key])) {
                        ret.push({
                            type: key,
                            emotes: bySet[data[1][key]].map(function(emote) {
                                return {
                                    name: emote.name,
                                    url: emote.images.url_1x,
                                    srcset: EmotesModel.makeSrcSet(emote.images),
                                    animated: false
                                };
                            })
                        });
                    }
                }
                return ret;
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
