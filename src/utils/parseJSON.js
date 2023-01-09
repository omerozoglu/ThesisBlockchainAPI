const parseJSON = (value) => {
  let parsed;

  try {
    parsed = JSON.parse(value);
  } catch (e) {
    return {};
  }

  return parsed;
};
module.exports = parseJSON;
