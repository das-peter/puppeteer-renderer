'use strict'

  const express = require('express')
  const { URL } = require('url')
  const contentDisposition = require('content-disposition')
  const createRenderer = require('./renderer')

  const port = process.env.PORT || 3000

  const app = express()

  let renderer = null

// Configure.
  app.disable('x-powered-by')

  var bodyParser = require('body-parser')
  app.use(bodyParser.json({limit: '500mb'})) // support json encoded bodies
  app.use(bodyParser.urlencoded({limit: '500mb', extended: true })) // support encoded bodies

// Render url.
  app.use(async (req, res, next) => {
    let { url, type, ...options } = Object.assign(req.query || {}, req.body || {})
    const html = options.html;

  if (!url && !html) {
    return res.status(400).send('Search with url parameter. For example, ?url=http://yourdomain')
  }

  if (url && !url.includes('://')) {
    url = `http://${url}`
    console.log('Fetching from URL', url)
  }
  if (html) {
    console.log('Generating using passed in HTML')
    url = false
    if (!options.filename) {
      return res.status(400).send('Please specify the filename to use for the rendered html')
    }
  }
  console.log('URL', url);
  console.log('html', html);

  console.log('Generating', type)
  console.log('Options', options)

  try {
    switch (type) {
      case 'pdf':
        let filename = options.filename;
        let pdf;
        if (url) {
          console.log('URL-PDF');
          const urlObj = new URL(url)
          if (!filename) {
            console.log('Autocreate filename')
            let filename = urlObj.hostname
            if (urlObj.pathname !== '/') {
              filename = urlObj.pathname.split('/').pop()
              if (filename === '') filename = urlObj.pathname.replace(/\//g, '')
              const extDotPosition = filename.lastIndexOf('.')
              if (extDotPosition > 0) filename = filename.substring(0, extDotPosition)
            }
          }
          pdf = await renderer.pdfFromUrl(url, options)
        }
        else {
          console.log('HTML-PDF');
          pdf = await renderer.pdfFromHtml(html, options)
        }

        pdf = await renderer.addFullHtmlHeaderFooter(pdf, options);

        res
          .set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdf.length,
            'Content-Disposition': contentDisposition(filename + '.pdf', {type: ((options.dispositionInline) ? 'inline' : 'attachment')}),
          })
          .send(pdf)
        break

      case 'screenshot':
        const image = await renderer.screenshot(url, options)
        res
          .set({
            'Content-Type': 'image/png',
            'Content-Length': image.length,
          })
          .send(image)
        break

      default:
        const returnHtml = await renderer.render(url, options)
        res.status(200).send(returnHtml)
    }
  } catch (e) {
    next(e)
  }
})

// Error page.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).send('Oops, An expected error seems to have occurred.')
})

// Create renderer and start server.
createRenderer()
  .then(createdRenderer => {
    renderer = createdRenderer
    console.info('Initialized renderer.')

    app.listen(port, () => {
      console.info(`Listen port on ${port}.`)
    })
  })
  .catch(e => {
    console.error('Fail to initialze renderer.', e)
  })

// Terminate process
process.on('SIGINT', () => {
  process.exit(0)
})
