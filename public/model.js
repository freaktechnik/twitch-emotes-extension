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

        ebsURL: 'https://api.emotes.ch/emotes/',
        loadConfig: function() {
            if(twitch.configuration.global) {
                this.ebsURL = JSON.parse(twitch.configuration.global.content).cacheEbs;
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
            return fetch(this.ebsURL + this.channelId + '.json').then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("could not load user info");
            }).then(function(user) {
                EmotesModel.canHaveEmotes = !!user.type.length;
                EmotesModel.canHaveCheermotes = user.type === "partner";
                EmotesModel.username = user.username;
                if(!EmotesModel.isProd() && EmotesModel.channelId == DEV_CHANNEL) {
                    EmotesModel.canHaveEmotes = true;
                    EmotesModel.canHaveCheermotes = true;
                }
                EmotesModel.emotes = user.emotes;
                EmotesModel.cheermotes = user.cheermotes;
            });
        },

        getCheerEmotes: function() {
            if(!this.canHaveEmotes || !this.canHaveCheermotes) {
                return Promise.reject("User can not have cheer emotes");
            }
            return Promise.resolve(this.cheermotes);
        },

        getEmotes: function() {
            if(!this.canHaveEmotes) {
                return Promise.reject("User can not have Twitch emotes");
            }
            return Promise.resolve(this.emotes);
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
