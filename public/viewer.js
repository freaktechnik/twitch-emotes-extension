
(function() {
    "use strict";
    var twitch = window.Twitch.ext;
    var EmotesPanel = {
        TYPE: {
            TWITCH: 'twitch',
            BTTV: 'bttv',
            FFZ: 'ffz'
        },
        TIERS: {
            1: "",
            2: "_2000",
            3: "_3000"
        },
        SIZES: [
            1,
            1.5,
            2,
            3,
            4
        ],
        BTTV_SIZES: [
           1,
           2,
           3
        ],
        config: {
            bttv_expanded: false,
            bttv_title: '',
            bttv_visible: true,
            ffz_expanded: false,
            ffz_title: '',
            ffz_visible: true,
            labels: true,
            sub_action: '',
            sub_expanded_1: true,
            sub_expanded_2: true,
            sub_expanded_3: true,
            sub_title: '',
            sub_visible: true,
            tier_title_1: '',
            tier_title_2: '',
            tier_title_3: '',
            sub_tooltip: '',
            popout_expand: true
        },
        loaded: false,
        loading: false,
        receivedData: {
            auth: false,
            config: false
        },
        visibleCredits: [],
        setAuth: function(auth) {
            this.channelId = auth.channelId;
            this.clientId = auth.clientId;
            this.receivedData.auth = true;

            twitch.rig.log('got auth');

            if(!this.loading && !this.loaded && this.receivedData.config) {
                this.updatePanel().catch(function(e) {
                    twitch.rig.log(e.message);
                });
            }
        },
        setConfig: function(config) {
            this.config = config;
            twitch.rig.log('got config');
            this.receivedData.config = true;
            if(!this.loading && this.receivedData.auth) {
                this.updatePanel().catch(function(e) {
                    twitch.rig.log(e.message);
                });
            }
        },

        noSectionsVisible: function() {
            return !this.config.sub_visible && !this.config.bttv_visible && !this.config.ffz_visible;
        },

        doneLoading: function() {
            document.getElementById("loading").className = 'hidden';
        },

        noEmotes: function() {
            this.doneLoading();
            var base = document.getElementById("noemotes");
            base.className = '';
            document.getElementById('credits').className = 'hidden';
        },

        isPopout: function() {
            return location.search.includes("popout=true");
        },

        isProd: function() {
            return location.search.includes("state=released");
        },

        getExpandedPref: function(type) {
            switch(type) {
                case this.TYPE.BTTV:
                    return this.config.bttv_expanded;
                case this.TYPE.FFZ:
                    return this.config.ffz_expanded;
            }
        },

        needsChannelInfo: function() {
            return (!this.username && this.config.bttv_visible) || (this.canHaveEmotes === undefined && this.config.sub_visible);
        },

        updatePanel: function() {
            twitch.rig.log('loading panel');
            if(this.noSectionsVisible()) {
                this.loaded = true;
                this.noEmotes();
                return;
            }
            this.loading = true;
            var promise = Promise.resolve();
            if(this.needsChannelInfo()) {
                twitch.rig.log("needs channel info");
                promise = this.getChannelInfo();
            }
            return promise.then(function() {
                var gracefulFail = function() { return []; };
                return Promise.all([
                    EmotesPanel.config.sub_visible ? EmotesPanel.getEmotes().catch(gracefulFail) : Promise.resolve([]),
                    EmotesPanel.config.bttv_visible ? EmotesPanel.getBTTVEmotes().catch(gracefulFail) : Promise.resolve([]),
                    EmotesPanel.config.ffz_visible ? EmotesPanel.getFFZEmotes().catch(gracefulFail) : Promise.resolve([])
                ]);
            }).then(function(emoteSets) {
                EmotesPanel.loaded = true;
                EmotesPanel.loading = false;
                var typeMap = [
                    EmotesPanel.TYPE.TWITCH,
                    EmotesPanel.TYPE.BTTV,
                    EmotesPanel.TYPE.FFZ
                ];
                var base = document.getElementById("emotes");
                var addedSomeEmotes = false;
                var hasTwitchEmotes = false;
                var isPopout = EmotesPanel.isPopout();
                for(var i = 0; i < emoteSets.length; ++i) {
                    if(emoteSets[i].length) {
                        if(typeMap[i] === EmotesPanel.TYPE.TWITCH && EmotesPanel.config.sub_visible) {
                            for(var j = 0; j < emoteSets[i].length; ++j) {
                                var subPlan = emoteSets[i][j];
                                if(subPlan.emotes.length) {
                                    var tier = EmotesPanel.getTierFromPrice(subPlan.type);
                                    var section = EmotesPanel.makeEmoteSection(typeMap[i] + subPlan.type, subPlan.emotes, EmotesPanel.config["sub_expanded_" + tier]);
                                    base.appendChild(section);
                                    addedSomeEmotes = true;
                                    hasTwitchEmotes = true;
                                }
                            }
                        }
                        else {
                            var expandSection = (EmotesPanel.config.popout_expand && isPopout) || EmotesPanel.getExpandedPref(typeMap[i]);
                            var section = EmotesPanel.makeEmoteSection(typeMap[i], emoteSets[i], expandSection);
                            base.appendChild(section);
                            if(!addedSomeEmotes) {
                                addedSomeEmotes = !!emoteSets[i].length;
                            }
                        }
                        EmotesPanel.showCreditFooter(typeMap[i]);
                    }
                }
                if(!addedSomeEmotes) {
                    EmotesPanel.noEmotes();
                }
                else {
                    EmotesPanel.doneLoading();
                }
            }).catch(twitch.rig.log);
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

        makeSectionHeader: function(type) {
            var header = document.createElement('summary');
            var heading = document.createElement("h2");

            if(type.startsWith(this.TYPE.TWITCH)) {
                var price = type.substr(this.TYPE.TWITCH.length);
                var tier = this.getTierFromPrice(price);
                heading.textContent = (this.config.sub_title || "Twitch Subscription") + " (" + (this.config['tier_title_' + tier] || "Tier " + tier) + ")";

                //TODO don't show for plans user is already subbed for.
                var link = document.createElement("a");
                link.target = '_blank';
                link.href = 'https://www.twitch.tv/products/' + this.username + this.TIERS[tier];
                link.title = (this.config.sub_tooltip || "Subscribe for") + " " + price;
                link.textContent = this.config.sub_action || "Get";
                heading.appendChild(link);
            }
            else if(type === this.TYPE.FFZ) {
                heading.textContent = this.config.ffz_title || "FrankerFaceZ";
            }
            else if(type === this.TYPE.BTTV) {
                heading.textContent = this.config.bttv_title || "BetterTTV";
            }

            header.appendChild(heading);

            return header;
        },

        makeEmoteList: function(emotes) {
            var list = document.createElement('ul');
            for(var i = 0; i < emotes.length; ++i) {
                var emote = emotes[i];
                var image = new Image(emote.width, emote.height);
                image.src = emote.url;
                image.alt = emote.name;
                image.title = emote.name;
                if(emote.hasOwnProperty("srcset")) {
                    image.srcset = emote.srcset;
                }
                var figure = document.createElement("figure");
                figure.appendChild(image);
                if(this.config.labels) {
                    var caption = document.createElement("figcaption");
                    caption.textContent = emote.name;
                    figure.appendChild(caption);
                }
                var item = document.createElement("li");
                item.appendChild(figure);
                list.appendChild(item);
            }
            if(this.config.labels) {
                list.addEventListener("click", function(e) {
                    if(e.detail > 1 && e.target.tagName.toLowerCase() == 'img') {
                        var caption = e.target.parentNode.getElementsByTagName('figcaption')[0];
                        var selection = document.getSelection();
                        selection.selectAllChildren(caption);
                    }
                }, true);
            }
            return list;
        },

        makeEmoteSection: function(type, emotes, open) {
            var header = this.makeSectionHeader(type);
            var list = this.makeEmoteList(emotes);

            var wrapper = document.createElement("details");
            wrapper.appendChild(header);
            wrapper.appendChild(list);
            wrapper.open = open;
            return wrapper;
        },

        showCreditFooter: function(type) {
            var prefix = '';
            var showAnd = false;
            var saveType = type;
            if(this.visibleCredits.length == 0) {
                document.getElementById("credits").className = '';
            }
            if(type.startsWith(this.TYPE.TWITCH)) {
                prefix = 'sub';
                if(this.visibleCredits.indexOf(this.TYPE.BTTV) > -1) {
                    showAnd = 'bttv';
                }
                else if(this.visibleCredits.indexOf(this.TYPE.FFZ) > -1) {
                    showAnd = 'ffz';
                }
                saveType = this.TYPE.TWITCH;
            }
            else if(type === this.TYPE.FFZ) {
                prefix = 'ffz';
                if(this.visibleCredits.indexOf(this.TYPE.BTTV) > -1 || this.visibleCredits.indexOf(this.TYPE.TWITCH) > -1) {
                    showAnd = 'ffz';
                }
            }
            else if(type === this.TYPE.BTTV) {
                prefix = 'bttv';
                if(this.visibleCredits.indexOf(this.TYPE.TWITCH) > -1) {
                    showAnd = 'bttv';
                }
                else if(this.visibleCredits.indexOf(this.TYPE.FFZ) > -1 && this.visibleCredits.length == 1) {
                    showAnd = 'ffz';
                }
            }
            document.getElementById(prefix + 'credit').className = '';
            if(showAnd) {
                var ands = document.getElementById(showAnd + 'credit').getElementsByClassName('and hidden');
                if(ands.length) {
                    ands[0].className = 'and';
                }
            }
            this.visibleCredits.push(saveType);
        },

        getChannelInfo: function() {
            return fetch('https://api.twitch.tv/helix/users?id=' + this.channelId, {
                headers: {
                    "Client-ID": EmotesPanel.clientId
                }
            }).then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("could not load user status");
            }).then(function(user) {
                if(user.data.length) {
                    EmotesPanel.canHaveEmotes = !!user.data[0].broadcaster_type.length;
                    EmotesPanel.username = user.data[0].login;
                    if(!EmotesPanel.isProd() && EmotesPanel.channelId == '24261394') {
                        EmotesPanel.canHaveEmotes = true;
                    }
                }
                else {
                    throw new Error("no user returned");
                }
            }).catch(function(e) {
                EmotesPanel.noEmotes();
                throw e;
            });
        },

        makeEmoteUrl: function(emoteId, size) {
            size = size || "1.0";
            return 'https://static-cdn.jtvnw.net/emoticons/v1/' + emoteId + '/' + size;
        },

        makeSrcSet: function(emoteId) {
            return this.SIZES.map(function(density) {
                return EmotesPanel.makeEmoteUrl(emoteId, density.toFixed(1)) + ' ' + density.toString(10) + 'x';
            }).join(', ');
        },

        getEmotes: function() {
            if(!this.canHaveEmotes) {
                return Promise.reject("User can not have twitch emotes");
            }
            //TODO use official Twitch API if there ever is one (hint, hint)
            return fetch('https://te.humanoids.be/emotesets/' + this.channelId + '.json').then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("Could not get sub tier details");
            }).then(function(json) {
                return fetch('https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=' + Object.values(json).join(','), {
                    headers: {
                        "Client-ID": EmotesPanel.clientId,
                        Accept: "application/vnd.twitchtv.v5+json"
                    }
                }).then(function(r) {
                    if(r.ok && r.status === 200) {
                        return Promise.all([
                            r.json(),
                            json
                        ]);
                    }
                    throw new Error("Could not get emote sets");
                }).catch(console.error);
            }).then((data) => {
                var planKeys = Object.keys(data[1]);
                var ret = [];
                var key;
                for(var i = 0; i < planKeys.length; ++i) {
                    key = planKeys[i];
                    if(data[0].emoticon_sets.hasOwnProperty(data[1][key])) {
                        ret.push({
                            type: key,
                            emotes: data[0].emoticon_sets[data[1][key]].map(function(emote) {
                                return {
                                    name: emote.code,
                                    url: EmotesPanel.makeEmoteUrl(emote.id),
                                    srcset: EmotesPanel.makeSrcSet(emote.id)
                                };
                            })
                        });
                    }
                }
                return ret;
            });
        },

        getBTTVEmotes: function() {
            return fetch('https://api.betterttv.net/2/channels/' + this.username).then(function(res) {
                if(res.ok && res.status === 200) {
                    return res.json();
                }
                throw new Error("Could not load bttv channel info");
            }).then(function(json) {
                return json.emotes.map((e) => {
                    return {
                        name: e.code,
                        url: json.urlTemplate.replace('{{id}}', e.id).replace('{{image}}', '1x'),
                        srcset: EmotesPanel.BTTV_SIZES.map(function(s) {
                            return json.urlTemplate.replace("{{id}}", e.id).replace('{{image}}', s + 'x') + ' ' + s + 'x';
                        }).join(',')
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
                        width: emote.width
                    };
                });
            })
        },

        setTheme: function(theme) {
            document.body.className = theme;
        }
    };

    twitch.onAuthorized(function(auth) {
        EmotesPanel.setAuth(auth);
    });

    twitch.onContext(function(context) {
        EmotesPanel.setTheme(context.theme);
    });

    twitch.configuration.onChanged(function() {
        if(twitch.configuration.broadcaster) {
            EmotesPanel.setConfig(JSON.parse(twitch.configuration.broadcaster.content));
        }
        else {
            // We just want to invoke the setConfig callback in this case.
            EmotesPanel.setConfig(EmotesPanel.config);
        }
    });
})();
