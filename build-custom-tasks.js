const fs = require("fs");
const path = require("path");
const md5 = require('md5')

async function getHash(fn) {
  let content = await fs.promises.readFile(fn, "utf8");
  return md5(content);
}

function mulberry32(seed) {
  return function () {
    var t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const rand = mulberry32(43);


exports = (options = {}) => {
  return {
    name: 'customTasks',
    setup(build) {

      // In production build, just exclude everything ending in "test.js"
      if (options.prod) {
        build.onLoad({filter: /.*test\.js/}, async (args) => {
          console.log(args.path);
          return {contents: ''};
        });
      }

      // Before build, clean up maps in target folder
      build.onStart(async () => {
        if (!options.prod) return;
        try { fs.unlinkSync("public/app.js.map"); } catch {}
      });

      // When build is done, infuse cache busting hashes in hashes.html,
      // and also save them in version.html
      build.onEnd(async result => {
        // Get hashes
        let appJsHash = await getHash("public/app.js");
        let appCssHash = await getHash("public/app.css");
        let indexHtml = await fs.promises.readFile("src/index.html", "utf8");
        if (options.prod) {
          indexHtml = indexHtml.replace("./bundle.js", "./bundle.js?v=" + appJsHash);
          indexHtml = indexHtml.replace("./app.css", "./app.css?v=" + appCssHash);
          indexHtml = indexHtml.replace(/<!--LiveReload-->.*<!--LiveReload-->/is, "");
        }
        await fs.promises.writeFile("public/index.html", indexHtml);
        let hashesTogether = appJsHash + "\n" + appCssHash;
        if (hashesTogether.length != 65) throw "wrong combined hash length";
        await fs.promises.writeFile("public/hashes.html", hashesTogether);
      });
    }
  };
}
module.exports = exports;
