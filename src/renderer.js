'use strict'

const puppeteer = require('puppeteer')

// Load Hummus for extended pdf manipulation
const HummusRecipe = require('hummus-recipe')
const fs = require('fs')
const tmp = require('tmp');

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

  async pdfFromUrl(url, options = {}) {
    let page = null
    try {
      const { timeout, waitUntil, ...extraOptions } = options
      const page = await this.createPage(url, { timeout, waitUntil })
      const buffer = await this.pageBuffer(page, extraOptions)
      return buffer;
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async pdfFromHtml(html, options = {}) {
    let page = null
    try {
      page = await this.createPageFromHtml(html)
      const buffer = await this.pageBuffer(page, options)
      return buffer;
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  async pageBuffer(page, options) {
    const { timeout, waitUntil, ...extraOptions } = options

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
      //paperWidth: extraOptions.width || '',
      //paperHeight: extraOptions.height || '',
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
    if (renderOptions.fullHtmlHeaderFooter && renderOptions.fullHtmlHeaderFooter === 'true') {
      renderOptions.displayHeaderFooter = false;
      renderOptions.headerTemplate = '';
      renderOptions.footerTemplate = '';
    }
    console.log('Render Options')
    console.log(JSON.stringify(renderOptions, null, 4));
    console.log('END -----------------------------')

    return await page.pdf(renderOptions)
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

  async createPageFromHtml(html) {
    const page = await this.browser.newPage()
    await page.setContent(html)
    return page
  }

  async addFullHtmlHeaderFooter(pdf, options) {

    if (!options.displayHeaderFooter || options.displayHeaderFooter !== 'true') {
      return pdf;
    }
    if (!options.fullHtmlHeaderFooter || options.fullHtmlHeaderFooter !== 'true') {
      return pdf;
    }

    const renderOptions = {
      scale: 1,
      preferCSSPageSize: 'true',
      displayHeaderFooter: false,
      printBackground: 'true',
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      }
    };

    let headerPdfPath = tmp.tmpNameSync();
    let footerPdfPath = tmp.tmpNameSync();
    let outputPdfPath = tmp.tmpNameSync();
    let tmpPdfPath = tmp.tmpNameSync();
    tmp.setGracefulCleanup();

    try {
      fs.writeFile(tmpPdfPath, pdf, function(err) {
        if(err) {
          return console.log(err);
        }
      });

      let headerPDF = false;
      let footerPDF = false;
      if (options.headerTemplate) {
        let headerPDFContent = await this.pdfFromHtml(options.headerTemplate, renderOptions)

        headerPDF = new HummusRecipe(headerPDFContent, headerPdfPath);
        headerPDF.endPDF(()=>{ /* done! */ });
      }
      if (options.footerTemplate) {
        let footerPDFContent = await this.pdfFromHtml(options.footerTemplate, renderOptions)
        footerPDF = new HummusRecipe(footerPDFContent, footerPdfPath);
        footerPDF.endPDF(()=>{ /* done! */ });
      }

      // var contents = fs.readFileSync(headerPdfPath);
      // console.log(contents);

      let pdfDoc = new HummusRecipe(pdf, outputPdfPath);

  //    console.log(JSON.stringify(pdfDoc.metadata, null, 4));

      // @TODO add support for placeholders.
      // date formatted print date
      // title document title
      // url document location
      // pageNumber current page number
      // totalPages total pages in the document


      // Iterate over all pages.
      for(var p in pdfDoc.metadata) {
        if (!isNaN(p) && (headerPDF || footerPDF)) {
          // Issue: https://github.com/chunyenHuang/hummusRecipe/issues/43
          pdfDoc
            .editPage(p); // without this line, it errors trying to destructure the metadata since there is no current page being edited; see below
          if (headerPDF) {
            pdfDoc.overlay(headerPdfPath, 0, (Number(pdfDoc.metadata[p].height)  * -1) + headerPDF.metadata[1].height)
          }
          if (footerPDF) {
            pdfDoc.overlay(footerPdfPath)
          }
          pdfDoc.endPage() // without this line the call to endPDF throws `Unable to end PDF`
        }
      }
      //console.log(JSON.stringify(pdfDoc.metadata[1].height, null, 4));

      pdfDoc
        .endPDF(()=>{ /* done! */ })

      var contents = fs.readFileSync(outputPdfPath);
    }
    finally {
    }
    return contents;
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
