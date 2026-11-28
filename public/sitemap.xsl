<?xml version="1.0" encoding="UTF-8"?>
<!-- Makes /sitemap.xml readable in a browser. Google ignores this and reads the XML as usual. -->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex, follow"/>
        <title>Sitemap | MetsXMFanZone</title>
        <style>
          *{box-sizing:border-box}
          body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:#0a1628;color:#e8eef7}
          header{background:linear-gradient(135deg,#002d72,#0a1628);border-bottom:3px solid #ff5910;padding:24px 16px}
          .wrap{max-width:1100px;margin:0 auto}
          h1{margin:0 0 6px;font-size:26px;letter-spacing:.5px;text-transform:uppercase}
          h1 span{color:#ff5910}
          p.sub{margin:0;color:#9fb0c8;font-size:14px}
          .stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
          .pill{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600}
          main{padding:16px}
          h2{font-size:15px;text-transform:uppercase;letter-spacing:1px;color:#ff5910;margin:22px 0 8px}
          table{width:100%;border-collapse:collapse;background:#0f2038;border:1px solid #1e3352;border-radius:12px;overflow:hidden;table-layout:fixed}
          th{background:#132a4a;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#9fb0c8;padding:10px 12px}
          td{padding:9px 12px;border-top:1px solid #1e3352;font-size:14px;vertical-align:top}
          tr:hover td{background:#14294a}
          td.n{width:48px;color:#6f84a3;font-variant-numeric:tabular-nums}
          th.d,td.d{width:130px;white-space:nowrap;color:#9fb0c8}
          th.p,td.p{width:80px;text-align:center}
          td.u{overflow-wrap:anywhere}
          a{color:#e8eef7;text-decoration:none}
          a:hover{color:#ff5910;text-decoration:underline}
          @media (max-width:640px){th.d,td.d,th.p,td.p{display:none}h1{font-size:21px}}
          footer{text-align:center;color:#6f84a3;font-size:12px;padding:24px 16px}
        </style>
      </head>
      <body>
        <header>
          <div class="wrap">
            <h1>MetsXMFanZone <span>Sitemap</span></h1>
            <p class="sub">Every page and article on metsxmfanzone.com that search engines can find.</p>
            <div class="stats">
              <span class="pill"><xsl:value-of select="count(s:urlset/s:url)"/> total</span>
              <span class="pill"><xsl:value-of select="count(s:urlset/s:url[not(contains(s:loc,'/blog/'))])"/> pages</span>
              <span class="pill"><xsl:value-of select="count(s:urlset/s:url[contains(s:loc,'/blog/')])"/> articles</span>
            </div>
          </div>
        </header>
        <main class="wrap">
          <h2>Pages</h2>
          <table>
            <tr><th class="n">#</th><th>Page</th><th class="d">Updated</th><th class="p">Priority</th></tr>
            <xsl:for-each select="s:urlset/s:url[not(contains(s:loc,'/blog/'))]">
              <xsl:call-template name="row"/>
            </xsl:for-each>
          </table>
          <h2>Articles (newest first)</h2>
          <table>
            <tr><th class="n">#</th><th>Article</th><th class="d">Published</th><th class="p">Priority</th></tr>
            <xsl:for-each select="s:urlset/s:url[contains(s:loc,'/blog/')]">
              <xsl:call-template name="row"/>
            </xsl:for-each>
          </table>
        </main>
        <footer>MetsXMFanZone.com</footer>
      </body>
    </html>
  </xsl:template>
  <xsl:template name="row">
    <tr>
      <td class="n"><xsl:value-of select="position()"/></td>
      <td class="u"><a href="{s:loc}"><xsl:value-of select="substring-after(s:loc,'metsxmfanzone.com')"/></a></td>
      <td class="d"><xsl:value-of select="substring(s:lastmod,1,10)"/></td>
      <td class="p"><xsl:value-of select="s:priority"/></td>
    </tr>
  </xsl:template>
</xsl:stylesheet>
