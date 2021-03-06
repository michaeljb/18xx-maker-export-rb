const is = require("ramda/src/is");
const addIndex = require("ramda/src/addIndex");
const concat = require("ramda/src/concat");
const map = require("ramda/src/map");
const chain = require("ramda/src/chain");
const find = require("ramda/src/find");

const terrainMapping = {
  river: "water",
  stream: "water",
};

const getValues = (hex) => {
  if (!hex.values) {
    return [];
  }

  return map((v) => v.value, hex.values);
};

const compileValue = (hex) => {
  if (!hex.values) {
    return [];
  }
};

const compileTowns = (hex) => {
  if (!hex.centerTowns && !hex.towns) {
    return [];
  }

  let values = getValues(hex);

  return addIndex(map)((t, i) => {
    return "t=r:" + (values[i] || values[0] || 0);
  }, concat(hex.centerTowns || [], hex.towns || []));
};

const compileCities = (hex) => {
  if (!hex.cities) {
    return [];
  }

  let values = getValues(hex);

  return addIndex(map)((c, i) => {
    let city = "c=r:" + (values[i] || values[0] || 0);
    if (c.size > 1) {
      city += `,s:${c.size}`;
    }
    return city;
  }, hex.cities);
};

const compileTerrain = (hex) => {
  if (!hex.terrain) {
    return [];
  }

  let types = chain((t) => {
    if (t.type) {
      return [terrainMapping[t.type] || t.type];
    }
    return [];
  }, hex.terrain);

  let result = [];
  let cost = find((t) => t.cost, hex.terrain);
  if (cost) {
    result.push(`u=c:${cost.cost}`);
  }

  if (types.length > 0) {
    result.push(`t:${types.join("+")}`);
  }

  return [result.join(",")];
};

const compileOffboard = (hex) => {
  if (!hex.offBoardRevenue) {
    return [];
  }

  let colors = map((r) => {
    if (`${r.value || r.revenue || r.cost || 0}`.match(/^D/)) {
      return `diesel_${r.cost.replace(/^D/, "")}`;
    }
    return `${r.color}_${r.value || r.revenue || r.cost || 0}`;
  }, hex.offBoardRevenue.revenues);

  return [`o=r:${colors.join("|")}`];
};

const compileLabels = (hex) => {
  if (!hex.labels) {
    return [];
  }

  return map((l) => {
    return `l=${l.label}`;
  }, hex.labels);
};

const abrev = (a, b, rev) => {
  a = (a - 1) % 6;
  b = (b - 1) % 6;
  return [`a:${Math.min(a, b)},b:_${rev}`, `a:_${rev},b:${Math.max(a, b)}`];
};

const arev = (a, rev) => {
  a = (a - 1) % 6;
  return [`a:${a},b:_${rev}`];
};

const ab = (a, b) => {
  a = (a - 1) % 6;
  b = (b - 1) % 6;

  return [`a:${Math.min(a, b)},b:${Math.max(a, b)}`];
};

const aj = (a) => {
  a = (a - 1) % 6;
  return [`a:${a},b:j`];
};

const compileTrackGauge = (gauge) => {
  switch (gauge) {
    case "narrow":
      return ",t:n";
    case "dual":
      return ",t:d";
    case "line":
      return ",t:l";
    case "dashed":
      return ",t:-";
    default:
      return "";
  }
};

const compileTrackSides = (t, r) => {
  // Check if we have a revenue center to deal with
  const hasRevenue = !isNaN(r);
  const side = t.side || 1;

  // Now switch on type
  switch (t.type) {
    case "sharp":
      return hasRevenue ? abrev(side, side + 1, r) : ab(side, side + 1);
    case "gentle":
      return hasRevenue ? abrev(side, side + 2, r) : ab(side, side + 2);
    case "straight":
      return hasRevenue ? abrev(side, side + 3, r) : ab(side, side + 3);
    default:
      return hasRevenue ? arev(side, r) : aj(side);
  }
};

const compileTrack = (hex) => {
  if (!hex.track) {
    return [];
  }

  // Hack for now. If there are values on the hex than cut the track in half
  let numRevenue = (hex.values || []).length + (hex.offBoardRevenue ? 1 : 0);

  return addIndex(chain)((t, i) => {
    // Simple for now, just let every track cycle
    // between revenue locations
    let revenue = i % numRevenue;
    let sides = compileTrackSides(t, revenue);

    return map((s) => {
      return `p=${s}${compileTrackGauge(t.gauge)}`;
    }, sides);
  }, hex.track);
};

const compileColor = (hex) => {
  switch (hex.color) {
    case "water":
      return "blue";
    case "offboard":
      return "red";
    case "plain":
      return "white";
    default:
      return hex.color;
  }
};

const compileHex = (hex) => {
  if (hex.encoding) {
    return hex.encoding;
  }

  let all = [
    ...compileOffboard(hex),
    ...compileCities(hex),
    ...compileTowns(hex),
    ...compileTrack(hex),
    ...compileLabels(hex),
    ...compileTerrain(hex),
  ];

  let result = all.join(";");

  switch (result) {
    case "":
      return "blank";
    case "c=r:0":
      return "city";
    case "t=r:0":
      return "town";
    default:
      return result;
  }

  return result;
};

exports.compileColor = compileColor;
exports.compileHex = compileHex;
