
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
            popout_expand: true,
            bttv_animated: true,
            shadows: true
        },
        loaded: false,
        loading: false,
        receivedConfig: false,
        visibleCredits: [],
        setAuth: function(auth) {
            // Race condition
            if(!window.EmotesModel.channelId) {
              window.EmotesModel.setAuth(auth);
            }
            if(!this.loading && !this.loaded && this.receivedConfig) {
                this.updatePanel().catch(function(e) {
                    twitch.rig.log(e.message);
                });
            }
        },
        setConfig: function(config) {
            this.config = config;

            this.receivedConfig = true;
            if(!this.loading && window.EmotesModel.channelId) {
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

        getExpandedPref: function(type) {
            switch(type) {
                case this.TYPE.BTTV:
                    return this.config.bttv_expanded;
                case this.TYPE.FFZ:
                    return this.config.ffz_expanded;
            }
        },

        needsChannelInfo: function() {
            return (!window.EmotesModel.username && this.config.bttv_visible) ||
                ((window.EmotesModel.canHaveEmotes === undefined || !window.EmotesModel.username) && this.config.sub_visible);
        },

        updatePanel: function() {
            twitch.rig.log('loading panel');
            if(this.noSectionsVisible()) {
                this.loaded = true;
                this.noEmotes();
                return;
            }
            this.loading = true;
            if (!this.config.shadows) {
                document.body.classList.remove('shadows');
            }
            var promise = Promise.resolve();
            if(this.needsChannelInfo()) {
                twitch.rig.log("needs channel info");
                promise = window.EmotesModel.getChannelInfo();
            }
            return promise.then(function() {
                var gracefulFail = function() { return []; };
                return Promise.all([
                    EmotesPanel.config.sub_visible ? window.EmotesModel.getEmotes().catch(gracefulFail) : Promise.resolve([]),
                    EmotesPanel.config.bttv_visible ? window.EmotesModel.getBTTVEmotes().catch(gracefulFail) : Promise.resolve([]),
                    EmotesPanel.config.ffz_visible ? window.EmotesModel.getFFZEmotes().catch(gracefulFail) : Promise.resolve([])
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
                var isPopout = window.EmotesModel.isPopout();
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
                            var expandSection = (EmotesPanel.config.popout_expand && isPopout) || EmotesPanel.getExpandedPref(typeMap[i]) || (!twitch.configuration.broadcaster && !window.EmotesModel.canHaveEmotes);
                            var emotes = emoteSets[i];
                            if(typeMap[i] == EmotesPanel.TYPE.BTTV && !EmotesPanel.config.bttv_animated) {
                                emotes = emotes.filter(function(emote) {
                                    return !emote.animated;
                                });
                            }
                            var section = EmotesPanel.makeEmoteSection(typeMap[i], emotes, expandSection);
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
            }).catch(function(e) {
                EmotesPanel.noEmotes();
                twitch.rig.log(e.message);
            });
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
                heading.textContent = (this.config.sub_title || "Subscription") + " (" + (this.config['tier_title_' + tier] || "Tier " + tier) + ")";

                //TODO don't show for plans user is already subbed for.
                var link = document.createElement("a");
                link.target = '_blank';
                link.href = 'https://www.twitch.tv/products/' + EmotesModel.username + this.TIERS[tier];
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
