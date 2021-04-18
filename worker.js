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

  if(!/^\/channelData\/[0-9a-z_]+\.json$/.test(pathname)) {
    return new Response('Not Found', { status: 404 });
  }

  if(!['GET', 'OPTIONS'].includes(method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if(request.headers.has('Origin') && !request.headers.get('Origin').includes('3yumzvi6r4wfycsk7vt1kbtto9s0n3.ext-twitch.tv')) {
    return new Response('Forbidden', { status: 403, headers: {
      Vary: 'Origin',
    } });
  }

  //TODO enfore accept being json

  if(method === 'OPTIONS') {
    const resp = new Response(null, {
      status: 204,
      headers: {
        Allow: 'OPTIONS, GET',
        'Access-Control-Allow-Origin': 'https://3yumzvi6r4wfycsk7vt1kbtto9s0n3.ext-twitch.tv',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Origin, Authorization',
        Vary: 'Origin',
        'Access-Control-Max-Age': '604800', // 1w
        'Cache-Control': 'max-age=604800',
      },
    });
    return resp;
  }

  const channelId = pathname.split('/').pop().split('.').shift();
  if(!(await verifyJWT(request.headers.get('Authorization'), channelId))) {
    return new Response('Unauthorized', { status: 401, headers: {
      Vary: 'Authorization, Origin',
    } });
  }

  const cacheKey = new Request(cacheUrl, { method: 'GET' });
  const cache = caches.default;

  let response = await cache.match(cacheKey);

  if(!response) {
    try {
      const info = await getChannelInfo(channelId, event);
      const sets = await getEmoteSets(channelId);
      const data = { info, sets, ts: Date.now() };
      response = new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Cache-Control': 's-maxage=86400', // 24h
          'Content-Type': 'application/json;charset=UTF-8',
        },
      });
      event.waitUntil(storeInConfig(channelId, data));
    }
    catch(error) {
      if(error.message === 'no user returned' || error.message === 'Channel not found') {
        response = new Response('Not Found', {
          status: 404,
          headers: {
            'Cache-Control': 's-maxage=3600', // 1h
            'Content-Type': 'text/plain;charset=UTF-8',
          },
        });
      }
      else {
        //TODO forward other request errors?
        response = new Response(error.message, {
          status: 500,
          headers: {
            'Cache-Control': 's-maxage=10', // 10s
            'Content-Type': 'text/plain;charset=UTF-8',
          },
        });
      }
    }

    response.headers.append('Access-Control-Allow-Origin', 'https://3yumzvi6r4wfycsk7vt1kbtto9s0n3.ext-twitch.tv');

    event.waitUntil(cache.put(cacheKey, response.clone()));
  }

  response.headers.append('Vary', 'Authorization, Origin');
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

async function getChannelInfo(channelId, event) {
  const response = await fetch(`https://api.twitch.tv/helix/users?id=${channelId}`, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${await getToken(event)}`,
    }
  });
  if(!response.ok || response.status !== 200) {
    throw new Error('request error');
  }
  const user = await res.json();
  if(user.data.length) {
    const ret = {};
    ret.canHaveEmotes = !!user.data[0].broadcaster_type.length;
    ret.username = user.data[0].login;
    return ret;
  }
  throw new Error('no user returned');
}

async function getEmoteSets(channelId) {
  const apiResponse = await fetch(`https://api.twitchemotes.com/api/v4/channels/${channelId}`);
  if(!apiResponse.ok || apiResponse.status !== 200) {
    throw new Error('request error');
  }
  const content = await apiResponse.json();
  if(content.error) {
    throw new Error(content.error || apiResponse.statusText);
  }
  return {
    plans: content.plans,
    baseSet: content.base_set_id,
  };
}

async function storeInConfig(channelId, data) {
  return fetch(`https://api.twitch.tv/extensions/${TWITCH_CLIENT_ID}/configurations`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${await getJWT()}`,
    },
    body: JSON.stringify({
      channel_id: channelId,
      segment: 'developer',
      version: '1',
      content: JSON.stringify(data),
    }),
  });
  //TODO notify via pubsub?
}

async function getJWT() {
  const head = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const data = {
    exp: Math.ceil(Date.now() / 1000) + 30, // valid for 30s
    role: 'external',
    user_id: TWITCH_OWNER_ID || '24261394',
  };
  const encoder = new TextEncoder();
  const rawBody = `${btoa(head)}.${btoa(data)}`;
  const body = encoder.encode(rawBody);
  const key = await getJWTSecret();
  const signature = await crypto.subtle.sign('HMAC', key, body);
  const decoder = new TextDecoder();
  const rawSignature = decoder.decode(signature);
  return `${rawBody}.${rawSignature}`;
}

async function verifyJWT(jwt, channelId) {
  const [ header, body, signature ] = jwt.split('.', 3);
  try {
    const rawHeader = JSON.parse(atob(header));
    if(rawHeader.alg !== 'HS256' || rawHeader.typ !== 'JWT') {
      return false;
    }
  }
  catch {
    return false;
  }
  try {
    const rawBody = JSON.parse(atob(body));
    if(rawBody.exp < Math.floor(Date.now() / 1000) || rawBody.channel_id !== channelId || !['broadcaster', 'moderator', 'viewer'].includes(rawBody.role)) {
      return false;
    }
  }
  catch {
    return false;
  }
  const encoder = new TextEncoder();
  const payload = encoder.encode(`${header}.${body}`);
  const signatureBytes = encoder.encode(signature);
  const key = await getJWTSecret();
  return crypto.subtle.verify('HMAC', key, signatureBytes, payload);
}

function getJWTSecret() {
  const encoder = new TextEncoder();
  const rawKey = encoder.encode(atob(TWITCH_EXTENSION_SECRET));
  return crypto.subtle.importKey('raw', rawKey, {
    name: 'HMAC',
    hash: 'SHA-256',
  }, false, [ 'sign', 'verify' ]);
}

async function getToken(event) {
  const token = await ACCESS.get('token');
  if(token) {
    return token;
  }
  const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, {
    method: 'POST',
  });
  if(!response.ok || response.status !== 200) {
    throw new Error('Could not retrieve token');
  }
  const expiresBody = await response.json();
  event.waitUntil(ACCESS.put('token', expiresBody.access_token, { expirationTtl: expiresBody.expires_in }));
  return expiresBody.access_token;
}
