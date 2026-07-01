/*
 * html-strip — DevTools console snippet
 *
 * Does the same thing as the extension, without installing it: extracts the
 * page's main content, converts it to Markdown with a metadata header, and
 * copies it to the clipboard. Loads Readability + Turndown (+ the GFM plugin
 * for tables) from a CDN on the fly.
 *
 * USE: open DevTools -> Console, paste the ONE-LINER at the bottom, press Enter.
 *
 * Caveats:
 *  - Strict-CSP sites (e.g. GitHub, some banks) block the CDN import() and it
 *    will fail there. Works on most article/blog/docs pages.
 *  - Uses document.execCommand('copy') via a temp textarea instead of the async
 *    Clipboard API, because from the console the page often isn't "focused"
 *    and navigator.clipboard.writeText would throw.
 *
 * The readable version below is the source of truth; the one-liner and
 * bookmarklet at the end are minified copies of it.
 */

(async () => {
  const [{ Readability }, { default: TurndownService }, { gfm }] =
    await Promise.all([
      import('https://esm.sh/@mozilla/readability'),
      import('https://esm.sh/turndown'),
      import('https://esm.sh/turndown-plugin-gfm'),
    ]);

  const article = new Readability(document.cloneNode(true)).parse();
  if (!article || !article.content) {
    alert('html-strip: no main content found on this page');
    return;
  }

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  // Drop interactive / embedded elements so app pages don't leak widget markup.
  turndown.remove([
    'script',
    'style',
    'noscript',
    'svg',
    'iframe',
    'form',
    'button',
    'input',
    'textarea',
    'select',
  ]);
  turndown.use(gfm); // GitHub-flavored Markdown: tables, strikethrough, task lists.
  // gfm keeps headerless (no <th>) tables as raw HTML; convert those too.
  turndown.addRule('headerlessTable', {
    filter: (node) => node.nodeName === 'TABLE' && !node.querySelector('th'),
    replacement: (_content, node) => {
      const rows = Array.from(node.rows || []);
      if (rows.length === 0) return '';
      const rowCells = rows.map((row) =>
        Array.from(row.cells || []).map((cell) =>
          (cell.textContent || '').trim().replace(/\s+/g, ' ').replace(/\|/g, '\\|')
        )
      );
      const width = Math.max(...rowCells.map((cells) => cells.length));
      const line = (cells) => {
        const padded = cells.slice();
        while (padded.length < width) padded.push('');
        return '| ' + padded.join(' | ') + ' |';
      };
      const separator = '| ' + Array(width).fill('---').join(' | ') + ' |';
      const [header, ...body] = rowCells;
      return '\n\n' + [line(header), separator, ...body.map(line)].join('\n') + '\n\n';
    },
  });

  const header = [];
  if (article.title) header.push('# ' + article.title);
  header.push('Source: ' + location.href);
  if (article.byline) header.push('Author: ' + article.byline);
  if (article.publishedTime) header.push('Date: ' + article.publishedTime);
  if (article.siteName) header.push('Site: ' + article.siteName);

  const markdown =
    header.join('\n') + '\n\n' + turndown.turndown(article.content).trim() + '\n';

  const ta = document.createElement('textarea');
  ta.value = markdown;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();

  console.log(
    '%chtml-strip: copied ' + markdown.length + ' chars to clipboard ✓',
    'color:#0a0;font-weight:bold'
  );
})();

/* ─────────────────────────────────────────────────────────────────────────
 * ONE-LINER — paste this into the console:
 *
(async()=>{const[{Readability},{default:TurndownService},{gfm}]=await Promise.all([import('https://esm.sh/@mozilla/readability'),import('https://esm.sh/turndown'),import('https://esm.sh/turndown-plugin-gfm')]);const a=new Readability(document.cloneNode(true)).parse();if(!a||!a.content)return alert('html-strip: no main content found on this page');const td=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced'});td.remove(['script','style','noscript','svg','iframe','form','button','input','textarea','select']);td.use(gfm);td.addRule('ht',{filter:n=>n.nodeName==='TABLE'&&!n.querySelector('th'),replacement:(c,n)=>{const rs=Array.from(n.rows||[]);if(!rs.length)return '';const rc=rs.map(r=>Array.from(r.cells||[]).map(x=>(x.textContent||'').trim().replace(/\s+/g,' ').replace(/\|/g,'\\|')));const w=Math.max(...rc.map(c=>c.length));const ln=c=>{const p=c.slice();while(p.length<w)p.push('');return '| '+p.join(' | ')+' |'};const sp='| '+Array(w).fill('---').join(' | ')+' |';const[h,...b]=rc;return '\n\n'+[ln(h),sp,...b.map(ln)].join('\n')+'\n\n'}});const h=[];if(a.title)h.push('# '+a.title);h.push('Source: '+location.href);if(a.byline)h.push('Author: '+a.byline);if(a.publishedTime)h.push('Date: '+a.publishedTime);if(a.siteName)h.push('Site: '+a.siteName);const md=h.join('\n')+'\n\n'+td.turndown(a.content).trim()+'\n';const ta=document.createElement('textarea');ta.value=md;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();console.log('%chtml-strip: copied '+md.length+' chars to clipboard ✓','color:#0a0;font-weight:bold');})();
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BOOKMARKLET — save as a bookmark whose URL is the line below, then click it
 * on any page:
 *
javascript:(async()=>{const[{Readability},{default:TurndownService},{gfm}]=await Promise.all([import('https://esm.sh/@mozilla/readability'),import('https://esm.sh/turndown'),import('https://esm.sh/turndown-plugin-gfm')]);const a=new Readability(document.cloneNode(true)).parse();if(!a||!a.content)return alert('html-strip: no main content found on this page');const td=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced'});td.remove(['script','style','noscript','svg','iframe','form','button','input','textarea','select']);td.use(gfm);td.addRule('ht',{filter:n=>n.nodeName==='TABLE'&&!n.querySelector('th'),replacement:(c,n)=>{const rs=Array.from(n.rows||[]);if(!rs.length)return '';const rc=rs.map(r=>Array.from(r.cells||[]).map(x=>(x.textContent||'').trim().replace(/\s+/g,' ').replace(/\|/g,'\\|')));const w=Math.max(...rc.map(c=>c.length));const ln=c=>{const p=c.slice();while(p.length<w)p.push('');return '| '+p.join(' | ')+' |'};const sp='| '+Array(w).fill('---').join(' | ')+' |';const[h,...b]=rc;return '\n\n'+[ln(h),sp,...b.map(ln)].join('\n')+'\n\n'}});const h=[];if(a.title)h.push('# '+a.title);h.push('Source: '+location.href);if(a.byline)h.push('Author: '+a.byline);if(a.publishedTime)h.push('Date: '+a.publishedTime);if(a.siteName)h.push('Site: '+a.siteName);const md=h.join('\n')+'\n\n'+td.turndown(a.content).trim()+'\n';const ta=document.createElement('textarea');ta.value=md;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();alert('html-strip: copied '+md.length+' chars ✓');})();
 * ───────────────────────────────────────────────────────────────────────── */
