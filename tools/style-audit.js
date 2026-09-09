'use strict';
// Conservative source cleanup using Stylus' own parser. Only single-line
// declarations shadowed by the same selector and same conditional context qualify.
const fs = require('fs');
const path = require('path');
const Parser = require('stylus/lib/parser');
const root = path.resolve(__dirname, '..', 'source/_data/styles');
const files = fs.readdirSync(root).filter(name => /^\d.*\.styl$/.test(name)).sort();
const sources = new Map(files.map(name => [name, fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n').split('\n')]));
const seen = new Map();
const remove = new Map(files.map(name => [name, new Set()]));
let count = 0;
for (const [file, lines] of sources) {
  const ast = new Parser(lines.join('\n')).parse();
  function walk(nodes, context = []) {
    for (const node of nodes) {
      if (node.nodeName === 'group') {
        const selectors = node.nodes.map(selector => selector.segments.map(String).join('').trim()).sort().join(',');
        walk(node.block.nodes, [...context, selectors]);
      } else if (node.nodeName === 'media' || node.nodeName === 'supports') {
        walk(node.block.nodes, [...context, lines[node.lineno - 1].trim()]);
      } else if (node.nodeName === 'property') {
        const line = lines[node.lineno - 1];
        if (!/^\s*[\w-]+\s*:\s*[^{};]+;\s*$/.test(line)) continue;
        const property = node.segments.map(String).join('');
        const important = /!important/.test(line);
        const key = [...context, property].join('\n');
        const previous = seen.get(key);
        if (previous && (important || !previous.important)) {
          // Preserve adjacent declarations (e.g. overflow hidden -> clip fallbacks).
          if (!(previous.file === file && node.lineno === previous.line + 2)) {
            remove.get(previous.file).add(previous.line); count++;
          }
        }
        if (!previous || important || !previous.important) seen.set(key, { file, line: node.lineno - 1, important });
      }
    }
  }
  walk(ast.nodes);
}
if (process.argv.includes('--fix')) {
  // Mechanical removal preserves every retained declaration's cascade position.
  for (const [file, lines] of sources) {
    const cleaned = lines.filter((_, index) => !remove.get(file).has(index)).join('\n');
    fs.writeFileSync(path.join(root, file), cleaned);
  }
}
console.log(`${count} shadowed single-line declarations ${process.argv.includes('--fix') ? 'removed' : 'found'}.`);
