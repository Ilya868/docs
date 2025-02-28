import fs from 'fs'
import path from 'path'

export class RewriteAssetPathsPlugin {
  tempDirectory: string
  localDev: boolean
  replaceUrl: string

  constructor(tempDirectory: string, localDev: boolean, replaceUrl: string) {
    this.tempDirectory = tempDirectory
    this.localDev = localDev
    this.replaceUrl = replaceUrl
  }

  apply(registerAction: Function) {
    registerAction('onResourceSaved', async ({ resource }: any) => {
      // Show some activity
      process.stdout.write('.')

      // Only operate on HTML files
      if (!resource.isHtml() && !resource.isCss()) return

      // Get the text contents of the resource
      const text = resource.getText()
      let newBody = text

      // Rewrite HTML asset paths. Example:
      // ../assets/images/foo/bar.png ->
      // https://github.github.com/docs-ghes-3.10/assets/images/foo/bar.png

      if (resource.isHtml()) {
        // Remove nextjs scripts and manifest.json link
        newBody = newBody.replace(
          /<script\ssrc="(\.\.\/)*_next\/static\/[\w]+\/(_buildManifest|_ssgManifest).js?".*?><\/script>/g,
          '',
        )
        newBody = newBody.replace(/<link href=".*manifest.json".*?>/g, '')

        if (!this.localDev) {
          // Rewrite asset paths
          newBody = newBody.replace(
            /(?<attribute>src|href)="(?:\.\.\/|\/)*(?<basepath>_next\/static|javascripts|stylesheets|assets\/fonts|assets\/cb-\d+\/images|node_modules)/g,
            (match: string, attribute: string, basepath: string) => {
              const replaced = `${this.replaceUrl}/${basepath}`
              return `${attribute}="${replaced}`
            },
          )
        }
      }

      // Rewrite CSS asset paths. Example
      // url("../assets/fonts/alliance/alliance-no-1-regular.woff") ->
      // url("https://github.github.com/docs-ghes-3.10/assets/fonts/alliance/alliance-no-1-regular.woff")
      // url(../../../assets/cb-303/images/octicons/search-24.svg) ->
      // url(https://github.github.com/docs-ghes-3.10/assets/cb-303/images/octicons/search-24.svg)
      if (resource.isCss()) {
        if (!this.localDev) {
          newBody = newBody.replace(
            /(?<attribute>url)(?<paren>\("|\()(?:\.\.\/)*(?<basepath>_next\/static|assets\/fonts|assets\/images|assets\/cb-\d+\/images)/g,
            (match: string, attribute: string, paren: string, basepath: string) => {
              const replaced = `${this.replaceUrl}/${basepath}`
              return `${attribute}${paren}${replaced}`
            },
          )
        }
      }

      const filePath = path.join(this.tempDirectory, resource.getFilename())
      await fs.promises.writeFile(filePath, newBody, resource.encoding)
    })
  }
}
