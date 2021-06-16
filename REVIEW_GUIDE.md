## Changes

- Use new Cheermotes endpoint
- Only use the twitch theme for dak/light mode choice
- Hide animated emotes if user prefers reduced motion
- Don't show empty sections
- Only show cheermotes configuration if cheermotes are available for a channel (i.e. they are partnered)

TODO update guide
## Guide

The extension shows all subscriber, BTTV and FFZ emotes available on a channel. My channel (freaktechnik) is configured by the backend to show the sub emotes of a different channel (Adam13531). It also gets the Cheermotes from CohhCarnage's channel for demonstration purposes, as with the sub emotes this is only in the non-production version on my channel. The extension has code to treat my channel as partner/affiliate when not in production, so subscription links also show up, even though the extension knows you can't subscribe to my channel. The subscription links it shows are not intended to be working, since they point to the product pages my channel would have, were it an affiliate/partnered channel. That channel name is overridable in the config, so I could set it to something valid.

All the sections are hideable in the config and their default collapsed state can be controlled, too. For BTTV there's a special setting to show animated emotes. I've chosen to hide them by default to keep the panel area calmer. The title of every section can be chosen.

All sections can be collapsed and expanded by the user. Subscription emote sections also get a button to subscribe to that tier (if the user isn't already subscribed at that tier or higher).

If the user authorizes the extension to access their information it reacts to their subscription status, else it just assumes they're subscribed and not subscribed at the same time.

If a user is not subscribed, or their tier is not high enough, emotes they'd get access to by subscribing show a lock icon, and when clicked on, the user is offered a subscribe button to subscribe to the tier that unlocks the emote.

When the user is subscribed, they don't see the subscription button in the header of the section for the tier and tiers below the one they're subscribed to. They also don't get any lock icons (anonymous users also don't get those) and they get a button to copy the emote code when they click on the emote.

Clicking on the emote brings up an overlay, that shows the emote without any overlays or underlays (lock, "drop shadow"/spotlight), a toggle to view the emote against light and dark backgrounds, the emote code and an optional description by the broadcaster. The description is set in the configuration by clicking on the emote in the configuration.

Lastly, the overlay shows the buttons with the appropriate actions for the user.

There are global settings to toggle the shadows/spotlights, a toggle to show the emote codes in the basic panel view and the option to disable the popout version having all sections expanded.
