const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'data', 'shaheen-heasley.ged');
const shaheenFile = path.join(__dirname, 'data', 'shaheen.ged');
const heasleyFile = path.join(__dirname, 'data', 'heasley.ged');

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split(/\r?\n/);

// 1. Group lines into records
const records = [];
let current = null;

for (const line of lines) {
  if (line.trim() === '') continue;
  if (line.match(/^0 /)) {
    if (current) records.push(current);
    const parts = line.split(' ');
    const idMatch = line.match(/^0 (@[A-Z0-9_]+@) /);
    current = {
      id: idMatch ? idMatch[1] : null,
      type: idMatch ? parts[2] : parts[1],
      lines: [line],
      refs: []
    };
  } else {
    if (current) {
      current.lines.push(line);
      // Extract all GEDCOM pointer references (e.g. @F45@, @S123@)
      const refMatches = line.match(/@[A-Z0-9_]+@/g);
      if (refMatches) {
        current.refs.push(...refMatches);
      }
    }
  }
}
if (current) records.push(current);

// 2. Define targets and boundaries
const michaelId = '@I412076094635@'; // Michael Leslie Shaheen
const amandaId = '@I412054722274@'; // Amanda Heasley
const marriageFamId = '@F26@'; // The marriage family to sever

// 3. Build adjacency graph for families and individuals ONLY
const graph = new Map();
records.forEach(r => {
  if (r.id && (r.type === 'INDI' || r.type === 'FAM')) {
    if (!graph.has(r.id)) graph.set(r.id, new Set());

    r.refs.forEach(ref => {
      const refRecord = records.find(rec => rec.id === ref);
      // Only link INDI and FAM records to find the core family trees
      if (refRecord && (refRecord.type === 'INDI' || refRecord.type === 'FAM')) {
        graph.get(r.id).add(ref);
        if (!graph.has(ref)) graph.set(ref, new Set());
        graph.get(ref).add(r.id);
      }
    });
  }
});

// 4. Traverse the graph to find all connected components (INDI & FAM)
function getCoreTree(startId, blockedIds) {
  const visited = new Set();
  const queue = [startId];
  while (queue.length > 0) {
    const curr = queue.shift();
    if (visited.has(curr) || blockedIds.has(curr)) continue;
    visited.add(curr);
    const neighbors = graph.get(curr) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor) && !blockedIds.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

// Block the marriage family to prevent the traversals from crossing over
const blocked = new Set([marriageFamId]);
const michaelCore = getCoreTree(michaelId, blocked);
const amandaCore = getCoreTree(amandaId, blocked);

// 5. Expand the core tree to include all referenced assets (SOUR, OBJE, REPO)
function expandToAssets(coreSet) {
  const expanded = new Set(coreSet);
  const queue = Array.from(coreSet);
  while (queue.length > 0) {
    const currId = queue.shift();
    const currRec = records.find(r => r.id === currId);
    if (currRec) {
      for (const ref of currRec.refs) {
        if (!expanded.has(ref)) {
          // Do not expand into new INDI or FAM records, as they were already correctly bounded
          const refRecord = records.find(rec => rec.id === ref);
          if (refRecord && (refRecord.type === 'INDI' || refRecord.type === 'FAM')) {
            continue;
          }
          expanded.add(ref);
          queue.push(ref);
        }
      }
    }
  }
  return expanded;
}

const michaelFull = expandToAssets(michaelCore);
const amandaFull = expandToAssets(amandaCore);

// 6. Generate the new GEDCOM content
function generateGedcom(allowedIds) {
  const output = [];
  for (const r of records) {
    // Always include headers, submitters, and trailers
    if (!r.id || r.type === 'HEAD' || r.type === 'TRLR' || r.type === 'SUBM') {
      output.push(...r.lines);
      continue;
    }
    if (allowedIds.has(r.id)) {
      for (const line of r.lines) {
        // Strip out any references to the blocked marriage family
        if (line.includes(marriageFamId)) continue;
        output.push(line);
      }
    }
  }
  return output.join('\n');
}

fs.writeFileSync(shaheenFile, generateGedcom(michaelFull));
fs.writeFileSync(heasleyFile, generateGedcom(amandaFull));

console.log('Successfully split the family tree into:');
console.log(' - ' + shaheenFile);
console.log(' - ' + heasleyFile);