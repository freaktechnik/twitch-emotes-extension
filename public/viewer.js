
(function() {
    "use strict";
    var twitch = window.Twitch.ext;
    var EmotesPanel = {
        TYPE: {
            TWITCH: 'twitch',
            BTTV: 'bttv',
            FFZ: 'ffz'
        },
        loaded: false,
        visibleCredits: [],
        setAuth: function(auth) {
            this.channelId = auth.channelId;
            this.clientId = auth.clientId;

            if(!this.loaded) {
                this.updatePanel().catch(function(e) {
                    twitch.rig.log(e.message);
                });
            }
        },

        doneLoading: function() {
            document.getElementById("loading").className = 'hidden';
        },

        noEmotes: function() {
            this.doneLoading();
            var base = document.getElementById("noemotes");
            base.className = '';
            document.getElementsByTagName('small')[0].className = 'hidden';
        },

        updatePanel: function() {
            return this.getChannelInfo().then(function() {
                var gracefulFail = function() { return []; };
                return Promise.all([
                    EmotesPanel.getEmotes().catch(gracefulFail),
                    EmotesPanel.getBTTVEmotes().catch(gracefulFail),
                    EmotesPanel.getFFZEmotes().catch(gracefulFail)
                ]);
            }).then(function(emoteSets) {
                EmotesPanel.loaded = true;
                var typeMap = [
                    EmotesPanel.TYPE.TWITCH,
                    EmotesPanel.TYPE.BTTV,
                    EmotesPanel.TYPE.FFZ
                ];
                var base = document.getElementById("emotes");
                var addedSomeEmotes = false;
                var hasTwitchEmotes = false;
                for(var i = 0; i < emoteSets.length; ++i) {
                    if(emoteSets[i].length) {
                        if(typeMap[i] === EmotesPanel.TYPE.TWITCH) {
                            for(var j = 0; j < emoteSets[i].length; ++j) {
                                var subPlan = emoteSets[i][j];
                                if(subPlan.emotes.length) {
                                    var section = EmotesPanel.makeEmoteSection(typeMap[i] + subPlan.type, subPlan.emotes, true);
                                    base.appendChild(section);
                                    addedSomeEmotes = true;
                                    hasTwitchEmotes = true;
                                }
                            }
                        }
                        else {
                            var section = EmotesPanel.makeEmoteSection(typeMap[i], emoteSets[i], !hasTwitchEmotes);
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
            }).catch(console.error);
        },

        makeSectionHeader: function(type) {
            var header = document.createElement('summary');
            var heading = document.createElement("h2");

            if(type.startsWith(EmotesPanel.TYPE.TWITCH)) {
                heading.textContent = "Twitch Subscription (" + type.substr(EmotesPanel.TYPE.TWITCH.length) + ")";
            }
            else if(type === EmotesPanel.TYPE.FFZ) {
                heading.textContent = "FrankerFaceZ";
            }
            else if(type === EmotesPanel.TYPE.BTTV) {
                heading.textContent = "BetterTTV";
            }

            header.appendChild(heading);

            return header;
        },

        makeEmoteList: function(emotes) {
            var list = document.createElement('ul');
            for(var i = 0; i < emotes.length; ++i) {
                var emote = emotes[i];
                var image = new Image(emote.width, emote.height);
                //TODO srcset for retina
                image.src = emote.url;
                var figure = document.createElement("figure");
                figure.appendChild(image);
                var caption = document.createElement("figcaption");
                caption.textContent = emote.name;
                figure.appendChild(caption);
                var item = document.createElement("li");
                item.appendChild(figure);
                list.appendChild(item);
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
            if(type.startsWith(EmotesPanel.TYPE.TWITCH)) {
                prefix = 'sub';
                if(this.visibleCredits.indexOf(EmotesPanel.TYPE.BTTV) > -1) {
                    showAnd = 'bttv';
                }
                else if(this.visibleCredits.indexOf(EmotesPanel.TYPE.FFZ) > -1) {
                    showAnd = 'ffz';
                }
                saveType = EmotesPanel.TYPE.TWITCH;
            }
            else if(type === EmotesPanel.TYPE.FFZ) {
                prefix = 'ffz';
                if(this.visibleCredits.indexOf(EmotesPanel.TYPE.BTTV) > -1 || this.visibleCredits.indexOf(EmotesPanel.TYPE.TWITCH) > -1) {
                    showAnd = 'ffz';
                }
            }
            else if(type === EmotesPanel.TYPE.BTTV) {
                prefix = 'bttv';
                if(this.visibleCredits.indexOf(EmotesPanel.TYPE.TWITCH) > -1) {
                    showAnd = 'bttv';
                }
                else if(this.visibleCredits.indexOf(EmotesPanel.TYPE.FFZ) > -1 && this.visibleCredits.length == 1) {
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
                    if(EmotesPanel.channelId == '24261394') {
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
                                    url: 'https://static-cdn.jtvnw.net/emoticons/v1/' + emote.id + '/1.0'
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
                        url: json.urlTemplate.replace('{{id}}', e.id).replace('{{image}}', '1x')
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
    })
})();
