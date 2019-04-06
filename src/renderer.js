'use strict'

const puppeteer = require('puppeteer')

// Load Hummus for extended pdf manipulation
const HummusRecipe = require('hummus-recipe')
const fs = require('fs')
const tmp = require('tmp');

class Renderer {
  constructor(browser) {
    this.browser = browser
    tmp.setGracefulCleanup();
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
    if (options.fullHtmlHeaderFooter && options.fullHtmlHeaderFooter !== 'false') {
      renderOptions.displayHeaderFooter = false;
    }
    if (options.fullHtmlHeader && options.fullHtmlHeader !== 'false') {
      // Ensure the header is not set by regular handler.
      renderOptions.headerTemplate = ' ';
    }
    if (options.fullHtmlFooter && options.fullHtmlFooter !== 'false') {
      // Ensure the footer is not set by regular handler.
      renderOptions.footerTemplate = ' ';
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
    if (options.fullHtmlHeader && options.fullHtmlHeader !== 'false') {
      options.fullHtmlHeaderFooter = true;
      options.headerTemplate = options.fullHtmlHeader;
    }
    if (options.fullHtmlFooter && options.fullHtmlFooter !== 'false') {
      options.fullHtmlHeaderFooter = true;
      options.footerTemplate = options.fullHtmlFooter;
    }
    if (!options.fullHtmlHeaderFooter || options.fullHtmlHeaderFooter === 'false') {
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

    let footerPdfPath = tmp.tmpNameSync();
    let outputPdfPath = tmp.tmpNameSync();
    let tmpPdfPath = tmp.tmpNameSync();

    try {
      fs.writeFile(tmpPdfPath, pdf, function(err) {
        if(err) {
          return console.log(err);
        }
      });

      // var contents = fs.readFileSync(headerPdfPath);
      // console.log(contents);

      let pdfDoc = new HummusRecipe(pdf, outputPdfPath);

      console.log(JSON.stringify(pdfDoc.metadata, null, 4));

      // Iterate over all pages.
      for(var p in pdfDoc.metadata) {
        if (!isNaN(p) && (options.headerTemplate || options.footerTemplate)) {
          // Issue: https://github.com/chunyenHuang/hummusRecipe/issues/43
          pdfDoc
            .editPage(p); // without this line, it errors trying to destructure the metadata since there is no current page being edited; see below
          if (options.headerTemplate) {
            let headerPDF = await this.getHeaderPDF(options.headerTemplate, renderOptions, p, pdfDoc.metadata.pages);
            if (headerPDF) {
              const headerPDFDoc = new HummusRecipe(headerPDF, headerPDF);
              pdfDoc.overlay(headerPDF, 0, (Number(pdfDoc.metadata[p].height)  * -1) + headerPDFDoc.metadata[1].height)
            }
          }
          if (options.footerTemplate) {
            let footerPdf = await this.getFooterPDF(options.footerTemplate, renderOptions, p, pdfDoc.metadata.pages);
            if (footerPdf) {
              const footerPDFDoc = new HummusRecipe(footerPdf, footerPdf);
              pdfDoc.overlay(footerPdf, 0, 0);

            }
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

  /**
   * Generate the PDF to merge into the main document.
   *
   * Will re-generate only if the pageNumber placeholder is used.
   *
   * @TODO Can we do a pdf text replace instead a re-generate? Might be faster.
   */
  async getHeaderPDF(html, renderOptions, pageNumber, totalPages) {
    // Check if this header needs to be regenerated for each page.
    if (pageNumber == 1) {
      this.headerRegenerate = html.search('{pageNumber}') > -1;
    }
    if (this.headerRegenerate || pageNumber == 1 || typeof this.headerPDF === 'undefined') {
      this.headerPDF = this.generateOverlayPDF(html, renderOptions, pageNumber, totalPages)
    }
    return this.headerPDF;
  }

  /**
   * Generate the PDF to merge into the main document.
   *
   * Will re-generate only if the pageNumber placeholder is used.
   *
   * @TODO Can we do a pdf text replace instead a re-generate? Might be faster.
   */
  async getFooterPDF(html, renderOptions, pageNumber, totalPages) {
    // Check if this header needs to be regenerated for each page.
    if (pageNumber == 1) {
      this.footerRegenerate = html.search('{pageNumber}') > -1;
    }
    if (this.footerRegenerate || pageNumber == 1 ||typeof this.footerPDF === 'undefined') {
      this.footerPDF = this.generateOverlayPDF(html, renderOptions, pageNumber, totalPages)
    }
    return this.footerPDF;
  }

  async generateOverlayPDF(html, renderOptions, pageNumber, totalPages) {
    html = html
      .replace('{pageNumber}', pageNumber)
      .replace('{totalPages}', totalPages)
    let overlayPdfFile = tmp.tmpNameSync();
    renderOptions.margin = {top:0, right: 0, bottom: 0, left: 0};
    // console.log('OverlayRenderOptions', renderOptions);
    let overlayPDFContent = await this.pdfFromHtml(html, renderOptions)
    let overlayPDF = new HummusRecipe(overlayPDFContent, overlayPdfFile);
    overlayPDF.endPDF(()=>{ /* done! */ });
    // console.log('Overlay Metadata', overlayPDF.metadata)
    return overlayPdfFile;
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
