// Patches react-snap for build resilience:
// 1. A pageerror on one route (e.g. a third-party script like the Google Cast
//    SDK) logs a warning instead of aborting prerendering of remaining routes.
// 2. A navigation timeout on one route (e.g. a page that polls live data and
//    never reaches network-idle) skips that snapshot instead of aborting.
const fs = require('fs');
const filePath = 'node_modules/react-snap/src/puppeteer_utils.js';

function apply(src, target, replacement, label) {
  if (src.includes(replacement)) return [src, false];
  if (!src.includes(target)) {
    console.warn(`react-snap patch target not found for: ${label}; skipping`);
    return [src, false];
  }
  return [src.replace(target, replacement), true];
}

try {
  let src = fs.readFileSync(filePath, 'utf8');

  [src] = apply(
    src,
    `    } else {
      console.log(\`🔥  pageerror at \${route}:\`, e);
    }
    onError && onError();
  });`,
    `    } else {
      console.log(\`🔥  pageerror at \${route}:\`, e);
    }
    // PATCH (react-snap resilience): a pageerror on one route must not abort
    // prerendering of the remaining routes. Log only; do not shut down.
  });`,
    'pageerror resilience'
  );

  [src] = apply(
    src,
    `    } catch (e) {
        if (!shuttingDown) {
          console.log(\`🔥  error at \${route}\`, e);
        }
        shuttingDown = true;
      }`,
    `    } catch (e) {
        // PATCH (react-snap resilience): navigation timeouts on pages that
        // poll live data should skip that snapshot, not abort the crawl.
        const isTimeout = /TimeoutError|Navigation Timeout/i.test(String((e && e.message) || e));
        if (isTimeout) {
          console.log(\`⏰  timeout at \${route} — skipping snapshot\`);
        } else {
          if (!shuttingDown) {
            console.log(\`🔥  error at \${route}\`, e);
          }
          shuttingDown = true;
        }
      }`,
    'timeout resilience'
  );

  fs.writeFileSync(filePath, src);
  console.log('react-snap resilience patch applied');
} catch (e) {
  console.warn('react-snap patch skipped:', e.message);
}
