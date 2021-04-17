addEventListener('fetch', function(event) {
  const { request } = event;
  const response = handleRequest(request, event).catch(handleError);
  event.respondWith(response);
});

/**
 * Get the emote sets for a channel.
 * @param {Request} request
 * @param {Event} event
 * @returns {Promise<Response>}
 */
async function handleRequest(request, event) {
  const { method, url } = request;
  const cacheUrl = new URL(url);
  const { pathname, host } = cacheUrl;

  if(host !== 'api.emotes.ch') {
    return new Response('Not Found', { status: 404 });
  }

  if(!/^\/emotesets\/[0-9a-z_]+\.json$/.test(pathname)) {
    return new Response('Not Found', { status: 404 });
  }

  const cacheKey = new Request(cacheUrl, request);
  const cache = caches.default;

  let response = await cache.match(cacheKey);

  if(!response) {
    try {
      const channelId = pathname.split('/').pop().split('.').shift();
      const apiResponse = await fetch(`https://api.twitchemotes.com/api/v4/channels/${channelId}`);
      const content = await apiResponse.json();
      if(content.error) {
        const headers = {
          'Cache-Control': 's-maxage=3600', // 1h
          'Content-Type': 'text/plain;charset=UTF-8',
        };
        if(content.error === 'Channel not found') {
          response = new Response('Not Found', { status: 404, headers });
        }
        else {
          response = new Response(apiResponse.statusText, { status: apiResponse.status, headers });
        }
      }
      else {
        response = new Response(JSON.stringify(content.plans), {
          status: 200,
          headers: {
            'Cache-Control': 's-maxage=86400', // 24h
            'Content-Type': 'application/json;charset=UTF-8',
          },
        });
      }
    }
    catch(error) {
      console.error(error);
      response = new Response('Internal Server Error', {
        status: 500,
        headers: {
          'Cache-Control': 's-maxage=10', // 10s
          'Content-Type': 'text/plain;charset=UTF-8',
        },
      });
    }

    response.headers.append('Access-Control-Allow-Origin', 'https://3yumzvi6r4wfycsk7vt1kbtto9s0n3.ext-twitch.tv');

    event.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}

/**
 * Responds with an uncaught error.
 * @param {Error} error
 * @returns {Response}
 */
function handleError(error) {
  console.error('Uncaught error:', error);

  const { stack } = error
  return new Response(stack || error, {
    status: 500,
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
    },
  });
}
