

// --- TORRENT STREAM HELPER ---
function returnTorrentStream(magnetOrTorrent, title, infoHash) {


// --- TORRENTIO STYLE STREAM HANDLER PATCH ---
function formatTorrentResults(results) {
  if (!results) return { streams: [] }
  return {
    streams: results.map(r => ({
      name: [r.source, r.quality, r.size, r.seeds ? (r.seeds + ' seeds') : null].filter(Boolean).join(' | '),
      type: "torrent",
      url: r.magnet || r.torrent,
      infoHash: r.infoHash || undefined,
      behaviorHints: {
        bingeGroup: r.title || undefined,
        notWebReady: true
      }
    }))
  }
}
// --- END PATCH ---
  return {
    streams: [
      {
        name: title ? title + " (Torrent)" : "Torrent",
        type: "torrent",
        url: magnetOrTorrent,
        infoHash: infoHash || undefined,
        behaviorHints: {
          bingeGroup: title || undefined,
          notWebReady: true
        }
      }
    ]
  };
}
// --- END TORRENT STREAM HELPER ---


// --- PATCH ADDED: returnMagnetStream helper ---
function returnMagnetStream(magnetOrTorrent, title){
  return {
    streams: [
      {
        name: (title? title + " (torrent)" : "Torrent"),
        type: "torrent",
        url: magnetOrTorrent
      }
    ]
  };
}
// --- END PATCH ---
import Router from 'router'
import addonInterface from "./addon.js"
import landingTemplate from "./lib/util/landingTemplate.js"
import StreamProvider from './lib/stream-provider.js'
import { decode } from 'urlencode'
import qs from 'querystring'
import requestIp from 'request-ip'
import { getManifest } from './lib/util/manifest.js'
import { parseConfiguration } from './lib/util/configuration.js'
import { BadTokenError, BadRequestError, AccessDeniedError } from './lib/util/error-codes.js'

const router = new Router();

router.get('/', (_, res) => {
    res.redirect('/configure')
})

router.get('/:configuration?/configure', (req, res) => {
    const config = parseConfiguration(req.params.configuration)
    const landingHTML = landingTemplate(addonInterface.manifest, config)
    res.setHeader('content-type', 'text/html')
    res.end(landingHTML)
})

router.get('/:configuration?/manifest.json', (req, res) => {
    const config = parseConfiguration(req.params.configuration)
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(getManifest(config)))
})

router.get(`/:configuration?/:resource/:type/:id/:extra?.json`, (req, res, next) => {
    const { resource, type, id } = req.params
    const config = parseConfiguration(req.params.configuration)
    const extra = req.params.extra ? qs.parse(req.url.split('/').pop().slice(0, -5)) : {}

    addonInterface.get(resource, type, id, extra, config)
        .then(resp => {
            let cacheHeaders = {
                cacheMaxAge: 'max-age',
                staleRevalidate: 'stale-while-revalidate',
                staleError: 'stale-if-error'
            }

            const cacheControl = Object.keys(cacheHeaders)
                .map(prop => Number.isInteger(resp[prop]) && cacheHeaders[prop] + '=' + resp[prop])
                .filter(val => !!val).join(', ')

            res.setHeader('Cache-Control', `${cacheControl}, private`)
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(resp))
        })
        .catch(err => {
            console.error(err)
            handleError(err, res)
        })
})

router.get('/resolve/:debridProvider/:debridApiKey/:id/:hostUrl', (req, res) => {
    const clientIp = requestIp.getClientIp(req)
    StreamProvider.resolveUrl(req.params.debridProvider, req.params.debridApiKey, req.params.id, decode(req.params.hostUrl), clientIp)
        .then(url => {
            res.redirect(url)
        })
        .catch(err => {
            console.log(err)
            handleError(err, res)
        })
})

router.get('/ping', (_, res) => {
    res.statusCode = 200
    res.end()
})

function handleError(err, res) {
    if (err == BadTokenError) {
        res.writeHead(401)
        res.end(JSON.stringify({ err: 'Bad token' }))
    } else if (err == AccessDeniedError) {
        res.writeHead(403)
        res.end(JSON.stringify({ err: 'Access denied' }))
    } else if (err == BadRequestError) {
        res.writeHead(400)
        res.end(JSON.stringify({ err: 'Bad request' }))
    } else {
        res.writeHead(500)
        res.end(JSON.stringify({ err: 'Server error' }))
    }
}

export default function (req, res) {
    router(req, res, function () {
        res.statusCode = 404;
        res.end();
    });
}