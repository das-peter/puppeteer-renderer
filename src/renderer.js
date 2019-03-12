'use strict'

const puppeteer = require('puppeteer')

class Renderer {
  constructor(browser) {
    this.browser = browser
  }

  async createPage(url, options = {}) {
    const { timeout, waitUntil } = options
    const page = await this.browser.newPage()
    await page.goto(url, {
      timeout: Number(timeout) || 30 * 1000,
      waitUntil: waitUntil || 'networkidle2',
    })
    return page
  }

  async render(url, options = {}) {
    let page = null
    try {
      const { timeout, waitUntil } = options
      page = await this.createPage(url, { timeout, waitUntil })
      const html = await page.content()
      return html
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async pdf(url, options = {}) {
    let page = null
    try {
      const { timeout, waitUntil, ...extraOptions } = options
      page = await this.createPage(url, { timeout, waitUntil })

      const {
        scale,
        displayHeaderFooter,
        headerTemplate,
        footerTemplate,
        printBackground,
        preferCSSPageSize,
        landscape,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
      } = extraOptions

      const renderOptions = {
        ...extraOptions,
        scale: Number(scale || 1),
        paperWidth: Number(extraOptions.width || 0) || '8.5in',
        paperHeight: Number(extraOptions.height || 0) || '11in',
        preferCSSPageSize: preferCSSPageSize === 'true',
        displayHeaderFooter: displayHeaderFooter === 'true',
        headerTemplate: extraOptions.headerTemplate,
        footerTemplate: extraOptions.footerTemplate,
        printBackground: printBackground === 'true',
        landscape: landscape === 'true',
        margin: {
          top: (extraOptions.marginTop || 0),
          right: (extraOptions.marginRight || 0),
          bottom: (extraOptions.marginBottom || 0),
          left: (extraOptions.marginLeft || 0),
        }
      };
      console.log('Render Options')
      console.log(renderOptions)
      console.log('END -----------------------------')

      const buffer = await page.pdf(renderOptions)
      return buffer
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async screenshot(url, options = {}) {
    let page = null
    try {
      const { timeout, waitUntil, ...extraOptions } = options
      page = await this.createPage(url, { timeout, waitUntil })
      page.setViewport({
        width: Number(extraOptions.width || 800),
        height: Number(extraOptions.height || 600),
      })

      const { fullPage, omitBackground, imageType, quality } = extraOptions
      const buffer = await page.screenshot({
        ...extraOptions,
        type: imageType || 'png',
        quality: Number(quality) || (imageType === undefined || imageType == 'png' ? 0 : 100),
        fullPage: fullPage === 'true',
        omitBackground: omitBackground === 'true',
      })
      return buffer
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async close() {
    await this.browser.close()
  }
}

async function create() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'], ignoreHTTPSErrors: true })
  return new Renderer(browser)
}

module.exports = create
