
(function() {
    "use strict";
    var twitch = window.Twitch.ext;
    var EmotesPanel = {
        TYPE: {
            TWITCH: 'twitch',
            BTTV: 'bttv',
            FFZ: 'ffz',
            CHEER: 'cheer',
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
            sub_animated: true,
            tier_title_1: '',
            tier_title_2: '',
            tier_title_3: '',
            sub_tooltip: '',
            popout_expand: true,
            bttv_animated: false,
            shadows: true,
            details: [],
            broadcaster_name_override: '',
            cheer_visible: true,
            cheer_expanded: true,
            cheer_title: '',
            cheer_animated: true,
            bitstier_visible: true,
            bitstier_expanded: true,
            bitstier_title: '',
            follower_visible: true,
            follower_expanded: true,
            follower_action: '',
            follower_title: ''
        },
        loaded: false,
        loading: false,
        receivedConfig: false,
        visibleCredits: [],
        subTier: 0,
        isMobile: false,
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

            if(!this.config.hasOwnProperty('follower_visible')) {
                this.config.follower_visible = true;
            }
            if(!this.config.hasOwnProperty('bitstier_visible')) {
                this.config.bitstier_visible = true;
            }
            if(!this.config.hasOwnProperty('follower_expanded')) {
                this.config.follower_expanded = true;
            }
            if(!this.config.hasOwnProperty('bitstier_expanded')) {
                this.config.bitstier_expanded = true;
            }
            if(!this.config.hasOwnProperty('sub_animated')) {
                this.config.sub_animated = true;
            }

            this.receivedConfig = true;
            if(!this.loading && window.EmotesModel.channelId) {
                this.updatePanel().catch(function(e) {
                    twitch.rig.log(e.message);
                });
            }
        },

        updateViewer: function(isSubbed) {
            isSubbed = isSubbed || false;
            var subStatus = twitch.viewer.subscriptionStatus;
            this.subTier = this.isSubbed() ? 0 : parseInt(subStatus.tier[0], 10);
            if(isSubbed && this.subTier === 0) {
                this.subTier = 1;
            }
            if(!this.loading && window.EmotesModel.channelId && this.receivedConfig) {
                this.updatePanel(true);
            }
        },

        checkMobile: function() {
            const params = new URLSearchParams(location.search);
            this.isMobile = params.get('platform').toLowerCase() === 'mobile';
        },

        canSub: function(tier) {
            return !this.isMobile && !this.isSubbed(tier);
        },

        isSubbed: function(tier) {
            tier = tier || 0;
            return twitch.subscriptionStatus !== null && tier <= this.subTier;
        },

        getDescription: function(name) {
            if(!this.config.details || !this.config.details.length) {
                return '';
            }
            for(var i = 0; i < this.config.details.length; ++i) {
                if(this.config.details[i].name === name) {
                    return this.config.details[i].description;
                }
            }
            return '';
        },

        noSectionsVisible: function() {
            return !this.config.sub_visible && !this.config.bitstier_visible && !this.config.follower_visible && !this.config.bttv_visible && !this.config.ffz_visible;
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
                case this.TYPE.CHEER:
                    return this.config.cheer_expanded;
            }
        },

        needsChannelInfo: function() {
            return (window.EmotesModel.canHaveEmotes === undefined || !window.EmotesModel.username) && (this.config.sub_visible || this.config.bitstier_visible || this.config.follower_visible || this.config.cheer_visible);
        },

        resetPanel: function() {
            this.loaded = false;
            document.getElementById("emotes").className = 'hidden';
            document.getElementById("noemotes").className = 'hidden';
            document.getElementById("credits").className = 'hidden';
            document.getElementById("loading").className = '';
            document.getElementById("emotes").innerHTML = '';
            document.getElementById("subcredit").className = 'hidden';
            document.getElementById("bttvcredit").className = 'hidden';
            document.getElementById("ffzcredit").className = 'hidden';
            var ands = document.getElementById("credits").getElementsByClassName('and');
            for(var i = 0; i < ands.length; ++i) {
                ands[i].className = 'and hidden';
            }
        },

        updatePanel: function(cached) {
            cached = cached || false;
            if(this.loaded) {
                this.resetPanel();
            }
            if(this.noSectionsVisible()) {
                this.loaded = true;
                this.noEmotes();
                return;
            }
            this.loading = true;
            if (this.config.hasOwnProperty('shadows') && !this.config.shadows) {
                document.body.className = document.body.className.replace('shadows', '');
            }
            var promise = Promise.resolve();
            if(this.needsChannelInfo()) {
                promise = window.EmotesModel.getChannelInfo();
            }
            if(!cached || !this.cachedEmotes) {
                this.cachedEmotes = promise.then(function() {
                    var gracefulFail = function() { return []; };
                    return Promise.all([
                        (EmotesPanel.config.sub_visible || EmotesPanel.config.bitstier_visible || EmotesPanel.config.follower_visible) ? window.EmotesModel.getEmotes().catch(gracefulFail) : Promise.resolve([]),
                        EmotesPanel.config.cheer_visible ? window.EmotesModel.getCheerEmotes().catch(gracefulFail) : Promise.resolve([]),
                        EmotesPanel.config.bttv_visible ? window.EmotesModel.getBTTVEmotes().catch(gracefulFail) : Promise.resolve([]),
                        EmotesPanel.config.ffz_visible ? window.EmotesModel.getFFZEmotes().catch(gracefulFail) : Promise.resolve([])
                    ]);
                });
            }
            return this.cachedEmotes.then(function(emoteSets) {
                EmotesPanel.loaded = true;
                EmotesPanel.loading = false;
                var typeMap = [
                    EmotesPanel.TYPE.TWITCH,
                    EmotesPanel.TYPE.CHEER,
                    EmotesPanel.TYPE.BTTV,
                    EmotesPanel.TYPE.FFZ
                ];
                var base = document.getElementById("emotes");
                var addedSomeEmotes = false;
                var isPopout = window.EmotesModel.isPopout();
                for(var i = 0; i < emoteSets.length; ++i) {
                    if(typeMap[i] === EmotesPanel.TYPE.TWITCH) {
                        var collections = Array.isArray(emoteSets[i]) ? [] : Object.keys(emoteSets[i]).sort();
                        for(var j = 0; j < collections.length; ++j) {
                            var collection = collections[j];
                            var collectionEmotes = emoteSets[i][collection];
                            if(collectionEmotes.length) {
                                var section;
                                if(collection.startsWith('subscriptions')) {
                                    if(!EmotesPanel.config.sub_visible) {
                                        continue;
                                    }
                                    var tier = collection.slice('subscriptions'.length)[0] || '1';
                                    section = EmotesPanel.makeEmoteSection(typeMap[i] + tier, collectionEmotes, EmotesPanel.config["sub_expanded_" + tier]);
                                }
                                else {
                                    if(!EmotesPanel.config[collection + '_visible']) {
                                        continue;
                                    }
                                    section = EmotesPanel.makeEmoteSection(typeMap[i] + collection, collectionEmotes, EmotesPanel.config[collection + "_expanded"]);
                                }
                                base.appendChild(section);
                                addedSomeEmotes = true;
                                EmotesPanel.showCreditFooter(typeMap[i]);
                            }
                        }
                    }
                    else if(emoteSets[i].length) {
                        var expandSection = (EmotesPanel.config.popout_expand && isPopout) || EmotesPanel.getExpandedPref(typeMap[i]) || (!twitch.configuration.broadcaster && !window.EmotesModel.canHaveEmotes);
                        var emotes = emoteSets[i];
                        if((typeMap[i] == EmotesPanel.TYPE.BTTV && !EmotesPanel.config.bttv_animated) || window.matchMedia("(prefers-reduced-motion)").matches) {
                            emotes = emotes.filter(function(emote) {
                                return !emote.animated;
                            });
                        }
                        if(!emotes.length) {
                            continue;
                        }
                        var section = EmotesPanel.makeEmoteSection(typeMap[i], emotes, expandSection);
                        base.appendChild(section);
                        if(!addedSomeEmotes) {
                            addedSomeEmotes = !!emotes.length;
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

        getSubLink: function(tier) {
            var username = EmotesModel.username;
            if(tier === 1) {
                return 'https://www.twitch.tv/' + username + '/subscribe';
            }
            if(this.config.hasOwnProperty('broadcaster_name_override') && this.config.broadcaster_name_override) {
                username = this.config.broadcaster_name_override;
            }
            return 'https://www.twitch.tv/products/' + username + this.TIERS[tier];
        },

        makeSectionHeader: function(type) {
            var header = document.createElement('summary');
            var heading = document.createElement("h2");

            if(type.startsWith(this.TYPE.TWITCH)) {
                var tier = type.substr(this.TYPE.TWITCH.length);
                if(tier === 'follower') {
                    heading.textContent = this.config.follower_title || 'Follower';
                }
                else if(tier === 'bitstier') {
                    heading.textContent = this.config.bitstier_title || 'Bit Tier Rewards';
                }
                else {
                    heading.textContent = (this.config.sub_title || "Subscription") + " (" + (this.config['tier_title_' + tier] || "Tier " + tier) + ")";
                }

                if(tier === 'follower') {
                    var button = document.createElement("button");
                    button.textContent = this.config.follower_action || "Follow";
                    button.addEventListener("click", function() {
                        twitch.actions.followChannel(EmotesModel.username);
                    }, false);
                    twitch.actions.onFollow(function(didFollow, username) {
                        if(didFollow && username === EmotesModel.username) {
                            button.remove();
                        }
                    });
                    heading.appendChild(button);
                }
                else if(tier !== 'bitstier' && this.canSub(tier)) {
                    // var link = document.createElement("button");
                    // link.type = "button";
                    // link.addEventListener("click", function(e) {
                    //     twitch.actions.subscribeToChannel({
                    //         tier: tier + '000'
                    //     });
                    //     e.preventDefault();
                    // }, false);
                    var link = document.createElement("a");
                    link.href = this.getSubLink(tier);
                    link.title = this.config.sub_tooltip || "Subscribe";
                    link.textContent = this.config.sub_action || "Get";
                    link.target = '_blank';
                    heading.appendChild(link);
                }
            }
            else if(type === this.TYPE.FFZ) {
                heading.textContent = this.config.ffz_title || "FrankerFaceZ";
            }
            else if(type === this.TYPE.BTTV) {
                heading.textContent = this.config.bttv_title || "BetterTTV";
            }
            else if(type === this.TYPE.CHEER) {
                heading.textContent = this.config.cheer_title || 'Cheermotes';
            }

            header.appendChild(heading);

            return header;
        },

        setUpOverlay: function() {
            document.getElementById("overlayclose").addEventListener("click", function() {
                EmotesPanel.closeOverlay();
            }, false);
            var buttons = document.getElementsByClassName('bg-toggle')[0].getElementsByTagName('button');
            var emoteWrapper = document.getElementById("emotewrapper");
            for(var i = 0; i < buttons.length; ++i) {
                buttons[i].addEventListener("click", function() {
                    var newTheme = this.getAttribute("data-theme");
                    if(newTheme !== emoteWrapper.className) {
                        emoteWrapper.className = newTheme;
                        emoteWrapper.dispatchEvent(new Event('theme'));
                    }
                }, false);
            }
            document.getElementById("overlaycopy").addEventListener("click", function() {
                var caption = emoteWrapper.getElementsByTagName('figcaption')[0];
                var selection = document.getSelection();
                selection.selectAllChildren(caption);
                document.execCommand("copy");
            }, false);
            document.getElementById("overlaysub").addEventListener("click", function() {
                window.open(EmotesPanel.getSubLink(EmotesPanel.currentOverlayData.tier), '_blank');
            }, false);
            document.getElementById("overlayfollow").addEventListener("click", function() {
                twitch.actions.followChannel(EmotesModel.username);
            }, false);
            twitch.actions.onFollow(function(didFollow, username) {
                if(didFollow && username === EmotesModel.username) {
                    document.getElementById("overlayfollow").className = "hidden";
                }
            });
        },
        currentOverlay: null,
        currentOverlayData: null,
        closeOverlay: function() {
            this.currentOverlay.className = 'expandable';
            this.currentOverlay = null;
            this.currentOverlayData = null;
            document.getElementById("overlay").className = 'hidden';
            if(EmotesPanel.themeListener) {
                document.getElementById("emotewrapper").removeEventListener("theme", EmotesPanel.themeListener, false);
                EmotesPanel.themeListener = undefined;
            }
        },
        isNonSubTier: function(tier) {
            return ['bitstier', 'follower'].includes(tier);
        },
        addOverlayListener: function(item, emote, type) {
            item.addEventListener("click", function(e) {
                var emoteWrapper = document.getElementById("emotewrapper");
                emoteWrapper.className = document.body.className.replace('shadows', '').trim();
                var theme = emoteWrapper.className.indexOf('dark') === -1 ? 'light' : 'dark';
                var configType = type;
                var tier = 1;
                if(type.startsWith(EmotesPanel.TYPE.TWITCH)) {
                    tier = type.substr(EmotesPanel.TYPE.TWITCH.length);
                    if (EmotesPanel.isNonSubTier(tier)) {
                        configType = tier;
                    }
                    else {
                        configType = 'sub';
                    }
                }
                var animated = EmotesPanel.config[configType + '_animated'] && !window.matchMedia("(prefers-reduced-motion)").matches ? 'animated' : 'static';
                if(item.isSameNode(EmotesPanel.currentOverlay)) {
                    EmotesPanel.closeOverlay();
                    return;
                }
                item.className = 'highlighted';
                if(EmotesPanel.currentOverlay) {
                    EmotesPanel.closeOverlay();
                }
                var img = emoteWrapper.getElementsByTagName("img")[0];
                if(emote.url) {
                    img.src = emote.url;
                }
                else {
                    img.src = emote[theme][animated].url;
                    img.srcset = emote[theme][animated].srcset;
                    EmotesPanel.themeListener = function() {
                        theme = emoteWrapper.className.indexOf('dark') === -1 ? 'light' : 'dark';
                        img.src = emote[theme][animated].url;
                        img.srcset = emote[theme][animated].srcset;
                    };
                    emoteWrapper.addEventListener("theme", EmotesPanel.themeListener, false);
                }
                img.alt = emote.name;
                img.title = emote.name;
                if(emote.hasOwnProperty("srcset")) {
                    img.srcset = emote.srcset;
                }
                else if(emote.url) {
                    img.srcset = '';
                }
                emoteWrapper.getElementsByTagName("figcaption")[0].textContent = emote.name;

                var emoteDescription = EmotesPanel.getDescription(emote.name);
                var desc = document.getElementById("overlaydesc");
                if(emoteDescription) {
                    desc.textContent = emoteDescription;
                    desc.className = '';
                }
                else {
                    desc.className = 'hidden';
                }

                var canSub = false;
                var canFollow = false;
                if(type.startsWith(EmotesPanel.TYPE.TWITCH)) {
                    if(tier === 'follower') {
                        canFollow = true;
                        document.getElementById("overlayfollow").className = '';
                    }
                    else if(tier !== 'bitstier' && EmotesPanel.canSub(tier)) {
                        emote.tier = tier;
                        canSub = true;
                        document.getElementById("overlaysub").className = '';
                        document.getElementById("overlaysub").getElementsByClassName("tier")[0].textContent = "Tier " + tier;
                        if(twitch.viewer.isLinked && twitch.features.isSubscriptionStatusAvailable) {
                            document.getElementById("overlaycopy").className = 'hidden';
                        }
                        else {
                            document.getElementById("overlaycopy").className = '';
                        }
                    }
                }
                if(!canSub) {
                    document.getElementById("overlaysub").className = 'hidden';
                    document.getElementById("overlaycopy").className = '';
                }
                if(!canFollow) {
                    document.getElementById("overlayfollow").className = 'hidden';
                }

                EmotesPanel.currentOverlayData = emote;
                EmotesPanel.currentOverlay = item;

                document.getElementById("overlay").className = '';
            }, false);
        },

        makeEmoteList: function(emotes, type) {
            var list = document.createElement('ul');
            var isTwitch = type.startsWith(this.TYPE.TWITCH);
            var tier = 0;
            var theme = document.body.className.indexOf('dark') === -1 ? 'light' : 'dark';
            var configType = type;
            if(isTwitch) {
                tier = type.substr(this.TYPE.TWITCH.length);
                if (this.isNonSubTier(tier)) {
                    configType = tier;
                }
                else {
                    configType = 'sub';
                }
            }
            var animated = this.config[configType + '_animated'] && !window.matchMedia("(prefers-reduced-motion)").matches ? 'animated' : 'static';
            for(var i = 0; i < emotes.length; ++i) {
                var emote = emotes[i];
                var image = new Image(emote.width, emote.height);
                if(emote.url) {
                    image.src = emote.url;
                }
                else {
                    image.src = emote[theme][animated].url;
                    image.srcset = emote[theme][animated].srcset;
                }
                image.alt = emote.name;
                image.title = emote.name;
                if(emote.hasOwnProperty("srcset")) {
                    image.srcset = emote.srcset;
                }
                var imgWrapper = document.createElement('div');
                imgWrapper.appendChild(image);
                if(isTwitch && !this.isNonSubTier(tier) && twitch.viewer.isLinked && twitch.features.isSubscriptionStatusAvailable && this.canSub(tier)) {
                    var lock = document.createElement('span');
                    lock.className = 'lock';
                    lock.textContent = '🔒';
                    imgWrapper.appendChild(lock);
                }
                var figure = document.createElement("figure");
                figure.appendChild(imgWrapper);
                if(this.config.labels) {
                    var caption = document.createElement("figcaption");
                    caption.textContent = emote.name;
                    figure.appendChild(caption);
                }
                var item = document.createElement("li");
                item.className = 'expandable';
                this.addOverlayListener(item, emote, type);
                item.appendChild(figure);
                list.appendChild(item);
            }
            // if(this.config.labels) {
            //     list.addEventListener("click", function(e) {
            //         if(e.detail > 1 && e.target.tagName.toLowerCase() == 'img') {
            //             var caption = e.target.parentNode.getElementsByTagName('figcaption')[0];
            //             var selection = document.getSelection();
            //             selection.selectAllChildren(caption);
            //             e.preventDefault();
            //         }
            //     }, true);
            // }
            return list;
        },

        makeEmoteSection: function(type, emotes, open) {
            var header = this.makeSectionHeader(type);
            var list = this.makeEmoteList(emotes, type);

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
            else {
                return;
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
            if(!this.config.hasOwnProperty('shadows') || this.config.shadows) {
                theme += ' shadows';
            }
            document.body.className = theme;
        }
    };


    twitch.onAuthorized(function(auth) {
        EmotesPanel.setAuth(auth);
        EmotesPanel.updateViewer();

        if(twitch.features.isSubscriptionStatusAvailable) {
            twitch.viewer.onChanged(function() {
                EmotesPanel.updateViewer();
            });
        }
        else {
            var addedViewerChangeListener = false;
            twitch.features.onChanged(function(feats) {
                if(feats.indexOf('isSubscriptionStatusAvailable') !== -1 && twitch.features.isSubscriptionStatusAvailable && !addedViewerChangeListener) {
                    twitch.viewer.onChanged(function() {
                        EmotesPanel.updateViewer();
                    });
                    EmotesPanel.updateViewer();
                    addedViewerChangeListener = true;
                }
            })
        }
        EmotesPanel.setUpOverlay();
    });

    twitch.onContext(function(context) {
        EmotesPanel.setTheme(context.theme);
    });

    twitch.configuration.onChanged(function() {
        window.EmotesModel.loadConfig();
        if(twitch.configuration.broadcaster) {
            EmotesPanel.setConfig(JSON.parse(twitch.configuration.broadcaster.content));
        }
        else {
            // We just want to invoke the setConfig callback in this case.
            EmotesPanel.setConfig(EmotesPanel.config);
        }
    });
})();
