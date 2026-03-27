import Document, { Head, Html, Main, NextScript } from "next/document"

// Compatibility shim for the current Next.js production build on this app-router-first project.
// The app still renders from `app/`, but keeping a minimal custom Document avoids intermittent
// internal `/ _document` resolution failures during `next build` in this workspace setup.
export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="zh-CN">
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
